import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ClientData {
  client_no: string
  full_name: string
  email?: string
  occupation?: string
  id1_type?: string
  id1_number?: string
  id2_type?: string
  id2_number?: string
  address?: string
  phone_number?: string
  vehicle_number_plate?: string
  late_history?: number
}

interface LoanData {
  loan_no: string
  client_no: string
  client_name: string
  amount: number
  interests: number
  total_amount: number
  terms_weeks: number
  weekly_repay_min: number
  signed_date: string
  paid_by?: string
  start_date: string
  first_repayment_date: string
  end_date: string
  status: string
  remain_repay_amount: number
  payments: Array<{ date: string; amount: number }>
}

interface ImportData {
  clients: ClientData[]
  loans: LoanData[]
  mode?: 'clients' | 'loans' | 'all'
}

// Helper function to process in batches with concurrency limit
async function processInBatches<T, R>(
  items: T[],
  batchSize: number,
  processor: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.all(batch.map(processor))
    results.push(...batchResults)
  }
  return results
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting import process...')
    
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const importData: ImportData = await req.json()
    const mode = importData.mode || 'all'
    console.log(`Import mode: ${mode}`)
    console.log(`Received ${importData.clients?.length || 0} clients and ${importData.loans?.length || 0} loans`)
    
    const results = {
      clients: { success: 0, errors: [] as string[], skipped: 0 },
      loans: { success: 0, errors: [] as string[], skipped: 0 },
      payments: { success: 0, errors: [] as string[] }
    }

    // Import clients first
    const clientMap = new Map<string, string>()
    
    if (mode === 'clients' || mode === 'all') {
      console.log('Starting client import...')
      
      if (importData.clients.length > 0) {
        // Batch check existing clients
        console.log('Checking for existing clients...')
        const clientNos = importData.clients.map(c => c.client_no)
        const { data: existingProfiles, error: checkError } = await supabaseAdmin
          .from('profiles')
          .select('id, client_no')
          .in('client_no', clientNos)
        
        if (checkError) {
          console.error('Error checking existing clients:', checkError)
        } else {
          for (const profile of existingProfiles || []) {
            clientMap.set(profile.client_no, profile.id)
            results.clients.skipped++
          }
          console.log(`Found ${existingProfiles?.length || 0} existing clients`)
        }

        // Process clients that don't exist (with concurrency limit for auth creation)
        const clientsToImport = importData.clients.filter(c => !clientMap.has(c.client_no))
        console.log(`Importing ${clientsToImport.length} new clients...`)

        // Process clients in batches of 10 (to avoid overwhelming auth API)
        const BATCH_SIZE = 10
        for (let i = 0; i < clientsToImport.length; i += BATCH_SIZE) {
          const batch = clientsToImport.slice(i, i + BATCH_SIZE)
          const batchPromises = batch.map(async (client) => {
            try {
              const email = client.email || `client${client.client_no}@placeholder.aiic.nz`
              const password = `TempPass${client.client_no}!`
              
              // Create auth user
              const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
                email,
                password,
                email_confirm: true
              })

              if (authError) throw authError

              clientMap.set(client.client_no, authData.user.id)

              // Update profile with client data
              const profileData = {
                client_no: client.client_no,
                full_name: client.full_name,
                occupation: client.occupation,
                id1_type: client.id1_type,
                id1_number: client.id1_number,
                id2_type: client.id2_type,
                id2_number: client.id2_number,
                address: client.address,
                phone_number: client.phone_number,
                vehicle_number_plate: client.vehicle_number_plate,
                late_history: client.late_history
              }
              
              const { error: profileError } = await supabaseAdmin
                .from('profiles')
                .update(profileData)
                .eq('id', authData.user.id)

              if (profileError) throw profileError

              results.clients.success++
              console.log(`✓ Imported client ${client.client_no} - ${client.full_name}`)
            } catch (error) {
              const message = error instanceof Error ? error.message : 'Unknown error'
              console.error(`✗ Failed to import client ${client.client_no}:`, message)
              results.clients.errors.push(`${client.client_no} - ${client.full_name}: ${message}`)
            }
          })
          
          await Promise.all(batchPromises)
          console.log(`Processed batch ${Math.floor(i / BATCH_SIZE) + 1} of ${Math.ceil(clientsToImport.length / BATCH_SIZE)}`)
        }
      }
      
      console.log(`Client import complete: ${results.clients.success} succeeded, ${results.clients.skipped} skipped, ${results.clients.errors.length} failed`)
    }

    // Import loans and payments
    if (mode === 'loans' || mode === 'all') {
      console.log('Starting loan import...')
      
      // If importing loans only, fetch existing client mappings
      if (mode === 'loans') {
        console.log('Fetching existing client mappings...')
        const { data: profiles, error: profileError } = await supabaseAdmin
          .from('profiles')
          .select('client_no, id')
          .not('client_no', 'is', null)
        
        if (profileError) {
          console.error('Failed to fetch client mappings:', profileError)
        } else {
          for (const profile of profiles || []) {
            clientMap.set(profile.client_no, profile.id)
          }
          console.log(`Loaded ${clientMap.size} existing client mappings`)
        }
      }

      if (importData.loans.length > 0) {
        // Batch check existing loans
        console.log('Checking for existing loans...')
        const loanNos = importData.loans.map(l => l.loan_no)
        const { data: existingLoansData, error: loanCheckError } = await supabaseAdmin
          .from('loans')
          .select('loan_no')
          .in('loan_no', loanNos)
        
        const existingLoanNos = new Set((existingLoansData || []).map(l => l.loan_no))
        
        if (loanCheckError) {
          console.error('Error checking existing loans:', loanCheckError)
        } else {
          results.loans.skipped = existingLoanNos.size
          console.log(`Found ${existingLoanNos.size} existing loans`)
        }

        // Filter out existing loans and loans without valid client
        const loansToImport = importData.loans.filter(loanData => {
          if (existingLoanNos.has(loanData.loan_no)) {
            return false
          }
          const userId = clientMap.get(loanData.client_no)
          if (!userId) {
            results.loans.errors.push(`${loanData.loan_no} - ${loanData.client_name}: Client ${loanData.client_no} not found`)
            return false
          }
          return true
        })

        console.log(`Importing ${loansToImport.length} new loans...`)

        if (loansToImport.length === 0) {
          console.log('No new loans to import')
        } else {
          // Prepare batch data for loan applications
        const loanAppsToInsert = loansToImport.map(loanData => {
          const userId = clientMap.get(loanData.client_no)!
          return {
            user_id: userId,
            requested_amount: loanData.amount,
            approved_amount: loanData.amount,
            terms_weeks: loanData.terms_weeks,
            status: 'approved'
          }
        })

        // Batch insert loan applications
        console.log('Batch inserting loan applications...')
        const { data: insertedLoanApps, error: appBatchError } = await supabaseAdmin
          .from('loan_applications')
          .insert(loanAppsToInsert)
          .select('id')

        if (appBatchError) {
          throw new Error(`Failed to batch insert loan applications: ${appBatchError.message}`)
        }

        console.log(`✓ Inserted ${insertedLoanApps.length} loan applications`)

        // Prepare batch data for loans
        const loansToInsert = loansToImport.map((loanData, idx) => {
          const userId = clientMap.get(loanData.client_no)!
          const loanAppId = insertedLoanApps[idx].id
          const totalPaid = loanData.payments.reduce((sum, p) => sum + p.amount, 0)
          const remainingBalance = loanData.total_amount - totalPaid
          const weeksPassed = loanData.payments.length
          const termsRemaining = Math.max(0, loanData.terms_weeks - weeksPassed)

          return {
            loan_no: loanData.loan_no,
            application_id: loanAppId,
            user_id: userId,
            principal_amount: loanData.amount,
            interests: loanData.interests,
            interest_rate: loanData.interests > 0 ? (loanData.interests / loanData.amount * 100) : 0,
            total_amount: loanData.total_amount,
            terms_weeks: loanData.terms_weeks,
            terms_remaining: termsRemaining,
            weekly_payment: loanData.weekly_repay_min,
            signed_date: loanData.signed_date,
            paid_by: loanData.paid_by,
            start_date: loanData.start_date,
            next_payment_date: loanData.first_repayment_date,
            end_date: loanData.end_date,
            status: loanData.status.toLowerCase().includes('finish') ? 'completed' : 'active',
            remaining_balance: remainingBalance
          }
        })

        // Batch insert loans
        console.log('Batch inserting loans...')
        const { data: insertedLoans, error: loanBatchError } = await supabaseAdmin
          .from('loans')
          .insert(loansToInsert)
          .select('id, loan_no')

        if (loanBatchError) {
          throw new Error(`Failed to batch insert loans: ${loanBatchError.message}`)
        }

        console.log(`✓ Inserted ${insertedLoans.length} loans`)
        results.loans.success = insertedLoans.length

        // Create loan_no to loan_id mapping for payments
        const loanIdMap = new Map<string, string>()
        insertedLoans.forEach(loan => {
          loanIdMap.set(loan.loan_no, loan.id)
        })

        // Prepare batch data for all payments
        const allPaymentsToInsert: Array<{
          loan_id: string
          user_id: string
          amount: number
          payment_date: string
          remaining_balance_after: number
        }> = []

        loansToImport.forEach((loanData, loanIdx) => {
          const loanId = loanIdMap.get(loanData.loan_no)!
          const userId = clientMap.get(loanData.client_no)!
          let runningBalance = loanData.total_amount

          loanData.payments.forEach(payment => {
            runningBalance -= payment.amount
            allPaymentsToInsert.push({
              loan_id: loanId,
              user_id: userId,
              amount: payment.amount,
              payment_date: payment.date,
              remaining_balance_after: runningBalance
            })
          })
        })

        // Batch insert payments (in chunks if too large)
        if (allPaymentsToInsert.length > 0) {
          console.log(`Batch inserting ${allPaymentsToInsert.length} payments...`)
          const PAYMENT_BATCH_SIZE = 1000
          
          for (let i = 0; i < allPaymentsToInsert.length; i += PAYMENT_BATCH_SIZE) {
            const paymentBatch = allPaymentsToInsert.slice(i, i + PAYMENT_BATCH_SIZE)
            const { error: paymentBatchError } = await supabaseAdmin
              .from('payments')
              .insert(paymentBatch)

            if (paymentBatchError) {
              console.error(`Error inserting payment batch ${Math.floor(i / PAYMENT_BATCH_SIZE) + 1}:`, paymentBatchError)
              results.payments.errors.push(`Payment batch ${Math.floor(i / PAYMENT_BATCH_SIZE) + 1}: ${paymentBatchError.message}`)
            } else {
              results.payments.success += paymentBatch.length
              console.log(`✓ Inserted payment batch ${Math.floor(i / PAYMENT_BATCH_SIZE) + 1} (${paymentBatch.length} payments)`)
            }
          }
        }
        }
      }
    }
    
    console.log(`Import complete! Clients: ${results.clients.success} imported, ${results.clients.skipped} skipped | Loans: ${results.loans.success} imported, ${results.loans.skipped} skipped | Payments: ${results.payments.success}`)
    console.log(`Errors - Clients: ${results.clients.errors.length}, Loans: ${results.loans.errors.length}, Payments: ${results.payments.errors.length}`)

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Import failed with error:', message)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

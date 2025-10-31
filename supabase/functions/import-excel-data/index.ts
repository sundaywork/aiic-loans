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
      for (const client of importData.clients) {
      try {
        console.log(`Processing client ${client.client_no}:`, JSON.stringify({
          client_no: client.client_no,
          full_name: client.full_name,
          email: client.email,
          phone_number: client.phone_number
        }))
        
        // Check if client already exists
        const { data: existingProfile } = await supabaseAdmin
          .from('profiles')
          .select('id, client_no')
          .eq('client_no', client.client_no)
          .maybeSingle()
        
        if (existingProfile) {
          console.log(`⊘ Skipping client ${client.client_no} - ${client.full_name} (already exists)`)
          clientMap.set(client.client_no, existingProfile.id)
          results.clients.skipped++
          continue
        }

        const email = client.email || `client${client.client_no}@placeholder.aiic.nz`
        const password = `TempPass${client.client_no}!`
        
        console.log(`Creating auth user for ${client.client_no} with email: ${email}`)

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
        
        console.log(`Inserting profile data:`, JSON.stringify(profileData))
        
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
        console.error('Client data:', JSON.stringify({
          client_no: client.client_no,
          full_name: client.full_name,
          email: client.email || `client${client.client_no}@placeholder.aiic.nz`,
          phone_number: client.phone_number,
          address: client.address
        }))
        console.error('Full error object:', JSON.stringify(error, null, 2))
        results.clients.errors.push(`${client.client_no} - ${client.full_name}: ${message}`)
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
      
      for (const loanData of importData.loans) {
      try {
        console.log(`Processing loan ${loanData.loan_no} for client ${loanData.client_no}`)
        
        // Check if loan already exists
        const { data: existingLoan } = await supabaseAdmin
          .from('loans')
          .select('id, loan_no')
          .eq('loan_no', loanData.loan_no)
          .maybeSingle()
        
        if (existingLoan) {
          console.log(`⊘ Skipping loan ${loanData.loan_no} (already exists)`)
          results.loans.skipped++
          continue
        }

        const userId = clientMap.get(loanData.client_no)
        if (!userId) {
          throw new Error(`Client ${loanData.client_no} not found in ${mode === 'loans' ? 'database' : 'imported clients'}`)
        }
        
        console.log(`Creating loan application for ${loanData.loan_no}:`, JSON.stringify({
          user_id: userId,
          amount: loanData.amount,
          signed_date: loanData.signed_date,
          start_date: loanData.start_date,
          terms_weeks: loanData.terms_weeks
        }))

        // Create loan application first
        const loanAppData = {
          user_id: userId,
          requested_amount: loanData.amount,
          approved_amount: loanData.amount,
          terms_weeks: loanData.terms_weeks,
          status: 'approved'
        }
        
        console.log(`Inserting loan_application:`, JSON.stringify(loanAppData))
        
        const { data: loanApp, error: appError } = await supabaseAdmin
          .from('loan_applications')
          .insert(loanAppData)
          .select('id')
          .single()

        if (appError) throw appError

        // Calculate remaining balance and terms remaining
        const totalPaid = loanData.payments.reduce((sum, p) => sum + p.amount, 0)
        const remainingBalance = loanData.total_amount - totalPaid
        const weeksPassed = loanData.payments.length
        const termsRemaining = Math.max(0, loanData.terms_weeks - weeksPassed)

        // Create loan
        const loanInsertData = {
          loan_no: loanData.loan_no,
          application_id: loanApp.id,
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
        
        console.log(`Inserting loan:`, JSON.stringify(loanInsertData))
        
        const { data: loan, error: loanError } = await supabaseAdmin
          .from('loans')
          .insert(loanInsertData)
          .select('id')
          .single()

        if (loanError) throw loanError

        results.loans.success++
        console.log(`✓ Imported loan ${loanData.loan_no}`)

        // Import payments for this loan
        console.log(`  Importing ${loanData.payments.length} payments for loan ${loanData.loan_no}`)
        let runningBalance = loanData.total_amount
        for (const payment of loanData.payments) {
          try {
            runningBalance -= payment.amount
            const paymentData = {
              loan_id: loan.id,
              user_id: userId,
              amount: payment.amount,
              payment_date: payment.date,
              remaining_balance_after: runningBalance
            }
            
            console.log(`Inserting payment:`, JSON.stringify(paymentData))
            
            const { error: paymentError } = await supabaseAdmin
              .from('payments')
              .insert(paymentData)

            if (paymentError) throw paymentError
            results.payments.success++
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            console.error(`  ✗ Failed payment for ${loanData.loan_no} on ${payment.date}: ${message}`)
            results.payments.errors.push(`${loanData.loan_no} - ${payment.date}: ${message}`)
          }
        }
        console.log(`  ✓ Imported ${loanData.payments.length} payments for loan ${loanData.loan_no}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        console.error(`✗ Failed to import loan ${loanData.loan_no}:`, message)
        console.error('Loan data:', JSON.stringify({
          loan_no: loanData.loan_no,
          client_no: loanData.client_no,
          amount: loanData.amount,
          signed_date: loanData.signed_date,
          start_date: loanData.start_date,
          first_repayment_date: loanData.first_repayment_date,
          end_date: loanData.end_date,
          terms_weeks: loanData.terms_weeks,
          payments_count: loanData.payments.length
        }))
        console.error('Full error object:', JSON.stringify(error, null, 2))
        if (error && typeof error === 'object' && 'code' in error) {
          console.error('Error code:', error.code)
        }
        results.loans.errors.push(`${loanData.loan_no} - ${loanData.client_name}: ${message}`)
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

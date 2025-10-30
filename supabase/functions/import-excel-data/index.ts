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
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
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
    const results = {
      clients: { success: 0, errors: [] as string[] },
      loans: { success: 0, errors: [] as string[] },
      payments: { success: 0, errors: [] as string[] }
    }

    // Import clients first
    const clientMap = new Map<string, string>()
    
    for (const client of importData.clients) {
      try {
        const email = client.email || `client${client.client_no}@placeholder.com`
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
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
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
          })
          .eq('id', authData.user.id)

        if (profileError) throw profileError

        results.clients.success++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.clients.errors.push(`${client.client_no} - ${client.full_name}: ${message}`)
      }
    }

    // Import loans and payments
    for (const loanData of importData.loans) {
      try {
        const userId = clientMap.get(loanData.client_no)
        if (!userId) throw new Error(`Client ${loanData.client_no} not found`)

        // Create loan application first
        const { data: loanApp, error: appError } = await supabaseAdmin
          .from('loan_applications')
          .insert({
            user_id: userId,
            requested_amount: loanData.amount,
            approved_amount: loanData.amount,
            terms_weeks: loanData.terms_weeks,
            status: 'approved'
          })
          .select('id')
          .single()

        if (appError) throw appError

        // Calculate remaining balance and terms remaining
        const totalPaid = loanData.payments.reduce((sum, p) => sum + p.amount, 0)
        const remainingBalance = loanData.total_amount - totalPaid
        const weeksPassed = loanData.payments.length
        const termsRemaining = Math.max(0, loanData.terms_weeks - weeksPassed)

        // Create loan
        const { data: loan, error: loanError } = await supabaseAdmin
          .from('loans')
          .insert({
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
          })
          .select('id')
          .single()

        if (loanError) throw loanError

        results.loans.success++

        // Import payments for this loan
        let runningBalance = loanData.total_amount
        for (const payment of loanData.payments) {
          try {
            runningBalance -= payment.amount
            const { error: paymentError } = await supabaseAdmin
              .from('payments')
              .insert({
                loan_id: loan.id,
                user_id: userId,
                amount: payment.amount,
                payment_date: payment.date,
                remaining_balance_after: runningBalance
              })

            if (paymentError) throw paymentError
            results.payments.success++
          } catch (error) {
            const message = error instanceof Error ? error.message : 'Unknown error'
            results.payments.errors.push(`${loanData.loan_no} - ${payment.date}: ${message}`)
          }
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.loans.errors.push(`${loanData.loan_no} - ${loanData.client_name}: ${message}`)
      }
    }

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

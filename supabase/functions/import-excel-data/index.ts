import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ImportData {
  users: Array<{
    email: string
    password: string
    full_name?: string
    phone_number?: string
    address?: string
    bank_account?: string
    taxi_company_id?: string
  }>
  loanApplications: Array<{
    user_email: string
    requested_amount: number
    terms_weeks: number
    status?: string
  }>
  payments: Array<{
    user_email: string
    amount: number
    payment_date: string
    notes?: string
  }>
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

    const { data }: { data: ImportData } = await req.json()
    const results = {
      users: { success: 0, errors: [] as string[] },
      loanApplications: { success: 0, errors: [] as string[] },
      payments: { success: 0, errors: [] as string[] }
    }

    // Import users first
    const userIdMap = new Map<string, string>()
    
    for (const user of data.users) {
      try {
        // Create auth user
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: user.email,
          password: user.password,
          email_confirm: true
        })

        if (authError) throw authError

        userIdMap.set(user.email, authData.user.id)

        // Update profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: user.full_name,
            phone_number: user.phone_number,
            address: user.address,
            bank_account: user.bank_account,
            taxi_company_id: user.taxi_company_id
          })
          .eq('id', authData.user.id)

        if (profileError) throw profileError

        results.users.success++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.users.errors.push(`${user.email}: ${message}`)
      }
    }

    // Import loan applications
    const loanAppMap = new Map<string, string>()
    
    for (const app of data.loanApplications) {
      try {
        const userId = userIdMap.get(app.user_email)
        if (!userId) throw new Error('User not found')

        const { data: loanApp, error } = await supabaseAdmin
          .from('loan_applications')
          .insert({
            user_id: userId,
            requested_amount: app.requested_amount,
            terms_weeks: app.terms_weeks,
            status: app.status || 'submitted'
          })
          .select('id')
          .single()

        if (error) throw error

        loanAppMap.set(app.user_email, loanApp.id)
        results.loanApplications.success++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.loanApplications.errors.push(`${app.user_email}: ${message}`)
      }
    }

    // Import payments (requires active loans)
    for (const payment of data.payments) {
      try {
        const userId = userIdMap.get(payment.user_email)
        if (!userId) throw new Error('User not found')

        // Get active loan for user
        const { data: loan, error: loanError } = await supabaseAdmin
          .from('loans')
          .select('id, remaining_balance')
          .eq('user_id', userId)
          .eq('status', 'active')
          .single()

        if (loanError) throw new Error('No active loan found')

        const newBalance = parseFloat(loan.remaining_balance) - payment.amount

        const { error: paymentError } = await supabaseAdmin
          .from('payments')
          .insert({
            loan_id: loan.id,
            user_id: userId,
            amount: payment.amount,
            payment_date: payment.payment_date,
            remaining_balance_after: newBalance,
            notes: payment.notes
          })

        if (paymentError) throw paymentError

        // Update loan balance
        await supabaseAdmin
          .from('loans')
          .update({ remaining_balance: newBalance })
          .eq('id', loan.id)

        results.payments.success++
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error'
        results.payments.errors.push(`${payment.user_email}: ${message}`)
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

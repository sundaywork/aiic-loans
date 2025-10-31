import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.77.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('Starting clean imported data...')
    
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

    const results = {
      payments: 0,
      loans: 0,
      profiles: 0,
      users: 0,
      errors: [] as string[]
    }

    // Delete payments without notes
    console.log('Deleting payments without notes...')
    try {
      const { data: paymentsData, error: paymentsError } = await supabaseAdmin
        .from('payments')
        .delete()
        .is('notes', null)
        .select('id')
      
      if (paymentsError) throw paymentsError
      results.payments = paymentsData?.length || 0
      console.log(`✓ Deleted ${results.payments} payments`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('✗ Failed to delete payments:', message)
      results.errors.push(`Payments: ${message}`)
    }

    // Delete loans with loan_no not empty
    console.log('Deleting loans with loan_no...')
    try {
      const { data: loansData, error: loansError } = await supabaseAdmin
        .from('loans')
        .delete()
        .not('loan_no', 'is', null)
        .neq('loan_no', '')
        .select('id')
      
      if (loansError) throw loansError
      results.loans = loansData?.length || 0
      console.log(`✓ Deleted ${results.loans} loans`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('✗ Failed to delete loans:', message)
      results.errors.push(`Loans: ${message}`)
    }

    // Delete users with placeholder emails
    console.log('Deleting users with placeholder emails...')
    try {
      const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers()
      
      if (listError) throw listError
      
      const placeholderUsers = users.filter(user => user.email?.endsWith('placeholder.com'))
      console.log(`Found ${placeholderUsers.length} placeholder users`)
      
      for (const user of placeholderUsers) {
        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
        if (deleteError) {
          console.error(`✗ Failed to delete user ${user.email}:`, deleteError.message)
          results.errors.push(`User ${user.email}: ${deleteError.message}`)
        } else {
          results.users++
          console.log(`✓ Deleted user ${user.email}`)
        }
      }
      
      console.log(`✓ Deleted ${results.users} placeholder users`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('✗ Failed to delete placeholder users:', message)
      results.errors.push(`Users: ${message}`)
    }

    // Delete profiles with client_no not empty
    console.log('Deleting profiles with client_no...')
    try {
      const { data: profilesData, error: profilesError } = await supabaseAdmin
        .from('profiles')
        .delete()
        .not('client_no', 'is', null)
        .neq('client_no', '')
        .select('id')
      
      if (profilesError) throw profilesError
      results.profiles = profilesData?.length || 0
      console.log(`✓ Deleted ${results.profiles} profiles`)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error'
      console.error('✗ Failed to delete profiles:', message)
      results.errors.push(`Profiles: ${message}`)
    }
    
    console.log(`Clean complete! Deleted - Users: ${results.users}, Payments: ${results.payments}, Loans: ${results.loans}, Profiles: ${results.profiles}`)
    console.log(`Errors: ${results.errors.length}`)

    return new Response(
      JSON.stringify(results),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('Clean failed with error:', message)
    console.error('Stack trace:', error instanceof Error ? error.stack : 'No stack trace')
    return new Response(
      JSON.stringify({ error: message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

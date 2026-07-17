import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export async function GET() {
  const results = {
    env: { status: 'PENDING', url: '', error: null as any },
    connection: { status: 'PENDING', error: null as any },
    auth: { status: 'PENDING', userId: null as string | null, error: null as any },
    database: { status: 'PENDING', error: null as any },
    crud: { status: 'PENDING', details: [] as string[], error: null as any },
    rls: { status: 'PENDING', error: null as any },
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  // Step 1: Verify env vars
  results.env.url = supabaseUrl || ''
  if (!supabaseUrl || !supabaseAnonKey) {
    results.env.status = 'FAILED'
    results.env.error = 'NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY is missing'
    return NextResponse.json({ success: false, results })
  }
  results.env.status = 'SUCCESS'

  try {
    // Step 2: Connect / Init client
    const supabase = createClient(supabaseUrl, supabaseAnonKey)
    results.connection.status = 'SUCCESS'

    // Step 3: Auth Test (Sign Up a temporary user)
    const testEmail = `test-user-${Date.now()}-${Math.floor(Math.random() * 1000)}@example.com`
    const testPassword = `TestPassword123!`

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email: testEmail,
      password: testPassword,
    })

    if (signUpError) {
      results.auth.status = 'FAILED'
      results.auth.error = {
        message: signUpError.message,
        status: signUpError.status,
        name: signUpError.name,
      }
      return NextResponse.json({ success: false, results })
    }

    const session = signUpData.session
    const user = signUpData.user

    if (!user) {
      results.auth.status = 'FAILED'
      results.auth.error = 'User object is null after signUp'
      return NextResponse.json({ success: false, results })
    }

    results.auth.userId = user.id
    results.auth.status = 'SUCCESS'

    let authenticatedClient = supabase
    if (session) {
      authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        },
      })
    } else {
      // In local development, if email confirmation is enabled, we won't get a session from signUp.
      // Let's try to sign in. If email confirmation is enabled, sign in might fail with "Email not confirmed".
      const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({
        email: testEmail,
        password: testPassword,
      })

      if (!signInError && signInData.session) {
        authenticatedClient = createClient(supabaseUrl, supabaseAnonKey, {
          global: {
            headers: {
              Authorization: `Bearer ${signInData.session.access_token}`,
            },
          },
        })
      } else {
        // If email confirmation is required and auto-confirm is not set, we can't get a session.
        // We will output a descriptive warning but still test the database connection using public schema access.
        results.auth.status = 'WARNING'
        results.auth.error = `User created (ID: ${user.id}) but email confirmation is required, so session is not available. Skipping RLS/CRUD requiring user session.`
        
        // Let's try to fetch public schema / profiles table to test general connection/database
        const { error: dbError } = await supabase.from('profiles').select('*').limit(1)
        if (dbError) {
          results.database.status = 'FAILED'
          results.database.error = { message: dbError.message, code: dbError.code }
        } else {
          results.database.status = 'SUCCESS'
        }
        return NextResponse.json({ success: true, results })
      }
    }

    // Step 4: Database Connection Test (with authenticated client)
    // Query profiles to see if the trigger created a profile for our user
    const { data: profileData, error: profileError } = await authenticatedClient
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (profileError) {
      results.database.status = 'FAILED'
      results.database.error = {
        message: profileError.message,
        code: profileError.code,
        details: profileError.details,
      }
      return NextResponse.json({ success: false, results })
    }
    results.database.status = 'SUCCESS'

    // Step 5: CRUD Test on 'customers' table
    // CREATE
    const { data: newCustomer, error: createError } = await authenticatedClient
      .from('customers')
      .insert({
        owner_id: user.id,
        name: 'Test Customer',
        mobile_number: '9876543210',
        notes: 'Integration test record',
      })
      .select()
      .single()

    if (createError) {
      results.crud.status = 'FAILED'
      results.crud.error = { message: createError.message, code: createError.code }
      return NextResponse.json({ success: false, results })
    }
    results.crud.details.push('Create: Success')

    // READ
    const { data: fetchedCustomer, error: readError } = await authenticatedClient
      .from('customers')
      .select('*')
      .eq('id', newCustomer.id)
      .single()

    if (readError) {
      results.crud.status = 'FAILED'
      results.crud.error = { message: readError.message, code: readError.code }
      return NextResponse.json({ success: false, results })
    }
    results.crud.details.push('Read: Success')

    // UPDATE
    const { data: updatedCustomer, error: updateError } = await authenticatedClient
      .from('customers')
      .update({ name: 'Updated Test Customer' })
      .eq('id', newCustomer.id)
      .select()
      .single()

    if (updateError) {
      results.crud.status = 'FAILED'
      results.crud.error = { message: updateError.message, code: updateError.code }
      return NextResponse.json({ success: false, results })
    }
    results.crud.details.push('Update: Success')

    // Step 6: RLS Test
    // Create a client that has no authentication header
    const anonymousClient = createClient(supabaseUrl, supabaseAnonKey)
    const { data: rlsData, error: rlsError } = await anonymousClient
      .from('customers')
      .select('*')
      .eq('id', newCustomer.id)

    if (rlsError) {
      results.rls.status = 'FAILED'
      results.rls.error = { message: rlsError.message, code: rlsError.code }
      return NextResponse.json({ success: false, results })
    } else if (rlsData && rlsData.length > 0) {
      results.rls.status = 'FAILED'
      results.rls.error = 'Security breach: Anonymous client fetched a private customer record!'
      return NextResponse.json({ success: false, results })
    } else {
      results.rls.status = 'SUCCESS'
    }

    // DELETE (part of CRUD)
    const { error: deleteError } = await authenticatedClient
      .from('customers')
      .delete()
      .eq('id', newCustomer.id)

    if (deleteError) {
      results.crud.status = 'FAILED'
      results.crud.error = { message: deleteError.message, code: deleteError.code }
      return NextResponse.json({ success: false, results })
    }
    results.crud.details.push('Delete: Success')
    results.crud.status = 'SUCCESS'

    return NextResponse.json({ success: true, results })

  } catch (err: any) {
    const errorDetails = {
      message: err?.message || 'Unknown runtime error',
      stack: err?.stack,
    }
    return NextResponse.json({
      success: false,
      error: 'Unhandled exception occurred during testing',
      details: errorDetails,
      results,
    })
  }
}

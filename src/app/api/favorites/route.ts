// src/app/api/favorites/route.ts
// API endpoints for managing favorite trainers

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/favorites
 * Get all favorite trainers for the authenticated client
 *
 * Returns array of trainer profiles that the client has favorited
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to verify they're a client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, roles')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const isClient = (profile as any).role === 'client' ||
                     ((profile as any).roles && (profile as any).roles.includes('client'))

    if (!isClient) {
      return NextResponse.json(
        { error: 'Forbidden: Only clients can access favorites' },
        { status: 403 }
      )
    }

    // Get favorite trainers with their profile information
    const { data: favorites, error: favoritesError } = await supabase
      .from('favorite_trainers')
      .select(`
        id,
        trainer_id,
        created_at,
        trainer:profiles!trainer_id(
          id,
          first_name,
          last_name,
          email
        )
      `)
      .eq('client_id', user.id)
      .order('created_at', { ascending: false })

    if (favoritesError) {
      console.error('Error fetching favorites:', favoritesError)
      return NextResponse.json(
        { error: 'Failed to fetch favorites' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      favorites: favorites || [],
      count: favorites?.length || 0
    })
  } catch (error) {
    console.error('Get favorites error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/favorites
 * Add a trainer to favorites
 *
 * Body: { trainerId: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to verify they're a client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, roles')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const isClient = (profile as any).role === 'client' ||
                     ((profile as any).roles && (profile as any).roles.includes('client'))

    if (!isClient) {
      return NextResponse.json(
        { error: 'Forbidden: Only clients can add favorites' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { trainerId } = body

    if (!trainerId || typeof trainerId !== 'string') {
      return NextResponse.json(
        { error: 'Trainer ID is required' },
        { status: 400 }
      )
    }

    // Verify the trainer exists and is actually a trainer
    const { data: trainer, error: trainerError } = await supabase
      .from('profiles')
      .select('id, role, roles')
      .eq('id', trainerId)
      .single()

    if (trainerError || !trainer) {
      return NextResponse.json(
        { error: 'Trainer not found' },
        { status: 404 }
      )
    }

    const isTrainer = (trainer as any).role === 'trainer' ||
                      ((trainer as any).roles && (trainer as any).roles.includes('trainer'))

    if (!isTrainer) {
      return NextResponse.json(
        { error: 'Invalid trainer ID' },
        { status: 400 }
      )
    }

    // Add to favorites (will fail if already exists due to unique constraint)
    const { data: favorite, error: insertError } = await supabase
      .from('favorite_trainers')
      .insert({
        client_id: user.id,
        trainer_id: trainerId
      } as any)
      .select()
      .single()

    if (insertError) {
      // Check if it's a duplicate
      if (insertError.code === '23505') {
        return NextResponse.json(
          { error: 'Trainer already in favorites' },
          { status: 409 }
        )
      }

      console.error('Error adding favorite:', insertError)
      return NextResponse.json(
        { error: 'Failed to add favorite' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      favorite
    }, { status: 201 })
  } catch (error) {
    console.error('Add favorite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/favorites
 * Remove a trainer from favorites
 *
 * Body: { trainerId: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    const supabase = await createClient()

    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get user profile to verify they're a client
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, roles')
      .eq('id', user.id)
      .single()

    if (profileError || !profile) {
      return NextResponse.json(
        { error: 'Profile not found' },
        { status: 404 }
      )
    }

    const isClient = (profile as any).role === 'client' ||
                     ((profile as any).roles && (profile as any).roles.includes('client'))

    if (!isClient) {
      return NextResponse.json(
        { error: 'Forbidden: Only clients can remove favorites' },
        { status: 403 }
      )
    }

    // Parse and validate request body
    const body = await request.json()
    const { trainerId } = body

    if (!trainerId || typeof trainerId !== 'string') {
      return NextResponse.json(
        { error: 'Trainer ID is required' },
        { status: 400 }
      )
    }

    // Remove from favorites
    const { error: deleteError } = await supabase
      .from('favorite_trainers')
      .delete()
      .eq('client_id', user.id)
      .eq('trainer_id', trainerId)

    if (deleteError) {
      console.error('Error removing favorite:', deleteError)
      return NextResponse.json(
        { error: 'Failed to remove favorite' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true
    })
  } catch (error) {
    console.error('Remove favorite error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

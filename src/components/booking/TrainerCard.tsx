// src/components/booking/TrainerCard.tsx
// Card component for displaying trainer information with favorite toggle

'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Heart, Calendar } from 'lucide-react'
import { toast } from 'sonner'
import { formatName } from '@/lib/utils/name-formatter'

interface TrainerCardProps {
  trainer: {
    id: string
    firstName: string
    lastName: string
    email: string
    isFavorite: boolean
  }
  onFavoriteToggle: (trainerId: string, isFavorite: boolean) => void
  onViewAvailability: (trainerId: string) => void
}

export function TrainerCard({ trainer, onFavoriteToggle, onViewAvailability }: TrainerCardProps) {
  const [isFavorite, setIsFavorite] = useState(trainer.isFavorite)
  const [isTogglingFavorite, setIsTogglingFavorite] = useState(false)

  const handleFavoriteClick = async () => {
    setIsTogglingFavorite(true)

    try {
      const endpoint = '/api/favorites'
      const method = isFavorite ? 'DELETE' : 'POST'

      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ trainerId: trainer.id })
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to update favorite')
      }

      const newFavoriteStatus = !isFavorite
      setIsFavorite(newFavoriteStatus)
      onFavoriteToggle(trainer.id, newFavoriteStatus)

      toast.success(
        newFavoriteStatus
          ? `Added ${formatName(trainer.firstName, trainer.lastName, 'client')} to favorites`
          : `Removed ${formatName(trainer.firstName, trainer.lastName, 'client')} from favorites`
      )
    } catch (error) {
      console.error('Error toggling favorite:', error)
      toast.error(error instanceof Error ? error.message : 'Failed to update favorite')
    } finally {
      setIsTogglingFavorite(false)
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-6">
        <div className="flex items-center justify-between">
          <div className="flex-1">
            <h3 className="text-lg font-semibold mb-1">
              {formatName(trainer.firstName, trainer.lastName, 'client')}
            </h3>
            <p className="text-sm text-slate-600">{trainer.email}</p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={handleFavoriteClick}
              disabled={isTogglingFavorite}
              className={isFavorite ? 'text-red-500 hover:text-red-600' : 'text-slate-400 hover:text-red-500'}
            >
              <Heart
                className="h-5 w-5"
                fill={isFavorite ? 'currentColor' : 'none'}
              />
            </Button>

            <Button
              onClick={() => onViewAvailability(trainer.id)}
              className="font-bold"
            >
              <Calendar className="h-4 w-4 mr-2" />
              View Availability
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

'use client';

import { useState } from 'react';
import Image from 'next/image';
import { StarIcon, HandThumbUpIcon, HandThumbDownIcon } from '@heroicons/react/20/solid';

interface Review {
  id: string;
  rating: number;
  title: string | null;
  content: string | null;
  created_at: string;
  user: {
    full_name: string;
    avatar_url: string | null;
  };
  images: string[] | null;
  helpful_count: number;
  is_verified_purchase: boolean;
  user_vote?: number; // 1, -1, or 0
}

interface ReviewListProps {
  reviews: Review[];
  listingId: string; // Added listingId
}

export function ReviewList({ reviews, listingId }: ReviewListProps) {
  if (reviews.length === 0) {
    return (
      <div className="rounded-lg bg-gray-50 p-8 text-center text-gray-500">
        No hay opiniones todavía. ¡Sé el primero en opinar!
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {reviews.map((review) => (
        <ReviewItem key={review.id} review={review} listingId={listingId} />
      ))}
    </div>
  );
}

function ReviewItem({ review, listingId }: { review: Review; listingId: string }) {
  const [vote, setVote] = useState(review.user_vote || 0);
  const [helpfulCount, setHelpfulCount] = useState(review.helpful_count);
  const [isVoting, setIsVoting] = useState(false);

  const handleVote = async (type: 1 | -1) => {
    if (isVoting) return;
    
    const previousVote = vote;
    const previousCount = helpfulCount;
    
    let newVote = type;
    if (vote === type) return; 

    setVote(newVote);
    if (type === 1) setHelpfulCount(c => c + 1);
    if (type === -1 && previousVote === 1) setHelpfulCount(c => Math.max(0, c - 1));

    setIsVoting(true);
    try {
      const res = await fetch(`/api/listings/${listingId}/reviews/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ review_id: review.id, vote_type: newVote })
      });
      const data = await res.json();
      
      if (data && data.success) {
         setHelpfulCount(data.helpful_count);
      }
    } catch (e) {
      setVote(previousVote);
      setHelpfulCount(previousCount);
    } finally {
      setIsVoting(false);
    }
  };

  return (
    <div className="border-b border-gray-100 pb-6 last:border-0">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <div className="flex text-blue-500">
            {[1, 2, 3, 4, 5].map((rating) => (
              <StarIcon
                key={rating}
                className={review.rating >= rating ? 'text-blue-500' : 'text-gray-200'}
                style={{ width: 16, height: 16 }}
              />
            ))}
          </div>
          {review.user?.full_name && (
              <span className="text-xs text-gray-900 font-medium">{review.user.full_name}</span>
          )}
          <span className="text-xs text-gray-400">•</span>
          <span className="text-xs font-medium text-gray-500">
            {new Date(review.created_at).toLocaleDateString('es-MX', { year: 'numeric', month: 'long', day: 'numeric' })}
          </span>
        </div>
      </div>

      <div className="mt-2 flex items-center gap-2">
        {review.is_verified_purchase && (
          <span className="inline-flex items-center rounded-full bg-white px-2 py-0.5 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20">
            Compra verificada
          </span>
        )}
      </div>

      <h4 className="mt-2 text-sm font-bold text-gray-900">{review.title}</h4>
      <p className="mt-2 text-sm text-gray-600 whitespace-pre-line">{review.content}</p>

      {review.images && review.images.length > 0 && (
        <div className="mt-4 flex gap-2 overflow-x-auto pb-2">
          {review.images.map((img, i) => (
            <div key={i} className="relative h-20 w-20 flex-shrink-0 overflow-hidden rounded-lg border border-gray-200">
              <Image src={img} alt="Review image" fill className="object-cover" />
            </div>
          ))}
        </div>
      )}

      <div className="mt-4 flex items-center gap-4 text-xs text-gray-500">
        <span>¿Es útil esta opinión?</span>
        <button
          onClick={() => handleVote(1)}
          className={`flex items-center gap-1 hover:text-gray-900 ${vote === 1 ? 'text-blue-600 font-bold' : ''}`}
        >
          <HandThumbUpIcon className="h-4 w-4" />
          <span>{helpfulCount}</span>
        </button>
        <button
          onClick={() => handleVote(-1)}
          className={`flex items-center gap-1 hover:text-gray-900 ${vote === -1 ? 'text-red-600 font-bold' : ''}`}
        >
          <HandThumbDownIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

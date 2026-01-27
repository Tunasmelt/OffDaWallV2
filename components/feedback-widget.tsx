'use client';

import React from "react"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';

export function FeedbackWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!feedback.trim()) return;

    // Log feedback to console in development
    console.log('[OffDaWallV2] Feedback submitted:', feedback);

    // In production, send to feedback endpoint
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feedback,
          timestamp: Date.now(),
          page: window.location.pathname,
        }),
      });
    } catch (error) {
      console.error('[OffDaWallV2] Failed to submit feedback:', error);
    }

    setSubmitted(true);
    setTimeout(() => {
      setIsOpen(false);
      setSubmitted(false);
      setFeedback('');
    }, 2000);
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 bg-primary text-primary-foreground px-4 py-3 rounded-lg shadow-lg hover:bg-primary/90 transition-all transform hover:scale-105 font-bold uppercase text-sm tracking-wider"
        style={{ fontFamily: 'system-ui, sans-serif' }}
        aria-label="Give Feedback"
      >
        Feedback
      </button>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 bg-card border-2 border-primary rounded-lg shadow-2xl w-80 overflow-hidden">
      {/* Header */}
      <div className="bg-primary text-primary-foreground px-4 py-3 flex items-center justify-between">
        <h3 className="font-bold uppercase text-sm tracking-wider">
          Share Your Thoughts
        </h3>
        <button
          onClick={() => setIsOpen(false)}
          className="hover:bg-primary-foreground/20 p-1 rounded transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="p-4">
        {submitted ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🎉</div>
            <p className="font-bold mb-1">Thanks for the feedback!</p>
            <p className="text-sm text-muted-foreground">
              Your input helps us improve.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Tell us what you think about OffDaWall..."
              className="w-full min-h-[120px] p-3 bg-background border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary text-sm"
              autoFocus
            />
            <div className="flex gap-2 mt-3">
              <Button
                type="submit"
                className="flex-1 bg-primary hover:bg-primary/90"
                disabled={!feedback.trim()}
              >
                Submit
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsOpen(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}


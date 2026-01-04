'use client';

import { motion, AnimatePresence } from 'framer-motion';
import type { Activity } from '../../lib/omnium-client';

interface ActivityFeedProps {
  activities: Activity[];
}

function formatTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 60000) return 'just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)} min ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} hr ago`;
  return `${Math.floor(diff / 86400000)} days ago`;
}

const activityIcons: Record<Activity['type'], string> = {
  tip: '💸',
  join: '👋',
  convert: '🔄',
  mint: '✨',
  dividend: '📈',
  attention: '👀',
  interact: '💬',
};

const activityColors: Record<Activity['type'], string> = {
  tip: 'border-dim-purpose/30',
  join: 'border-dim-locality/30',
  convert: 'border-dim-temporal/30',
  mint: 'border-dim-magnitude/30',
  dividend: 'border-dim-reputation/30',
  attention: 'border-green-500/30',
  interact: 'border-blue-500/30',
};

export function ActivityFeed({ activities }: ActivityFeedProps) {
  return (
    <div className="bg-omnium-bg-secondary border border-omnium-muted/20 rounded-xl p-6">
      <h2 className="text-lg font-semibold text-omnium-text mb-4">Recent Activity</h2>

      {activities.length === 0 ? (
        <div className="text-center py-8 text-omnium-muted">
          <p>No activity yet</p>
          <p className="text-sm mt-1">Tips and joins will appear here</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto">
          <AnimatePresence>
            {activities.map((activity) => (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className={`flex items-start gap-3 p-3 bg-omnium-bg rounded-lg border ${activityColors[activity.type]}`}
              >
                <span className="text-lg">{activityIcons[activity.type]}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-omnium-text">
                    <span className="font-medium">{activity.actorName}</span>{' '}
                    <span className="text-omnium-muted">{activity.description}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    {activity.amount && (
                      <span className="text-xs text-dim-magnitude">{activity.amount}Ω</span>
                    )}
                    {activity.purpose && (
                      <span className="text-xs text-dim-purpose px-1.5 py-0.5 bg-dim-purpose/10 rounded">
                        {activity.purpose}
                      </span>
                    )}
                    {activity.temporality && activity.temporality !== 'T0' && (
                      <span className="text-xs text-dim-temporal px-1.5 py-0.5 bg-dim-temporal/10 rounded">
                        {activity.temporality === 'TInfinity' ? 'T∞' : activity.temporality}
                      </span>
                    )}
                    <span className="text-xs text-omnium-muted/60 ml-auto">
                      {formatTime(activity.timestamp)}
                    </span>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

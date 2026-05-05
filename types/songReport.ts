export type SongReportStatus = 'pending' | 'resolved';

export interface SongReport {
  id: string;
  song_id: string;
  reporter_id: string;
  title: string;
  reason: string;
  status: SongReportStatus;
  created_at: string;
}

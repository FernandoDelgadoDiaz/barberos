-- Enable Supabase Realtime for service_logs table
ALTER PUBLICATION supabase_realtime ADD TABLE service_logs;

-- Optionally enable for daily_summaries if needed in the future
-- ALTER PUBLICATION supabase_realtime ADD TABLE daily_summaries;
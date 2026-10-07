CREATE FUNCTION reject_event_changes() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'events is append-only: % is not allowed', TG_OP;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER events_append_only
BEFORE UPDATE OR DELETE ON events
FOR EACH ROW EXECUTE FUNCTION reject_event_changes();

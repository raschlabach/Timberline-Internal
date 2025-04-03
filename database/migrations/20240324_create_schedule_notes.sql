-- Create schedule_notes table
CREATE TABLE IF NOT EXISTS schedule_notes (
    id SERIAL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    content TEXT,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    is_recurring BOOLEAN DEFAULT false,
    recurrence_pattern JSONB,
    color VARCHAR(7) DEFAULT '#808080',
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
DROP TRIGGER IF EXISTS update_schedule_notes_updated_at ON schedule_notes;
CREATE TRIGGER update_schedule_notes_updated_at
    BEFORE UPDATE ON schedule_notes
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Create a view that expands recurring notes
CREATE OR REPLACE VIEW expanded_schedule_notes AS
WITH RECURSIVE expanded AS (
    -- Non-recurring notes with date range
    SELECT 
        id,
        title,
        content,
        start_date + (INTERVAL '1 day' * generate_series) as note_date,
        color,
        created_by,
        created_at,
        updated_at,
        is_recurring,
        recurrence_pattern,
        start_date,
        end_date
    FROM schedule_notes, generate_series(0, 365)
    WHERE NOT is_recurring
    AND start_date + (INTERVAL '1 day' * generate_series) <= end_date

    UNION ALL

    -- Recurring notes
    SELECT 
        id,
        title,
        content,
        CASE 
            WHEN (recurrence_pattern->>'frequency') = 'daily' THEN
                start_date + (INTERVAL '1 day' * (generate_series * (recurrence_pattern->>'interval')::integer))
            WHEN (recurrence_pattern->>'frequency') = 'weekly' THEN
                start_date + (INTERVAL '1 week' * (generate_series * (recurrence_pattern->>'interval')::integer))
            WHEN (recurrence_pattern->>'frequency') = 'monthly' THEN
                start_date + (INTERVAL '1 month' * (generate_series * (recurrence_pattern->>'interval')::integer))
            ELSE
                start_date
        END as note_date,
        color,
        created_by,
        created_at,
        updated_at,
        is_recurring,
        recurrence_pattern,
        start_date,
        end_date
    FROM 
        schedule_notes,
        generate_series(0, 730) -- Generate dates for up to two years
    WHERE 
        is_recurring
        AND CASE 
            WHEN (recurrence_pattern->>'frequency') = 'daily' THEN
                start_date + (INTERVAL '1 day' * (generate_series * (recurrence_pattern->>'interval')::integer)) <= end_date
                AND generate_series < COALESCE((recurrence_pattern->>'occurrences')::integer, 730)
            WHEN (recurrence_pattern->>'frequency') = 'weekly' THEN
                start_date + (INTERVAL '1 week' * (generate_series * (recurrence_pattern->>'interval')::integer)) <= end_date
                AND generate_series < COALESCE((recurrence_pattern->>'occurrences')::integer, 730)
                AND EXTRACT(DOW FROM start_date + (INTERVAL '1 week' * (generate_series * (recurrence_pattern->>'interval')::integer))) = ANY(
                    CASE 
                        WHEN jsonb_array_length(COALESCE(recurrence_pattern->'days', '[]'::jsonb)) > 0 
                        THEN ARRAY(SELECT jsonb_array_elements_text(recurrence_pattern->'days')::integer)
                        ELSE ARRAY[EXTRACT(DOW FROM start_date)::integer]
                    END
                )
            WHEN (recurrence_pattern->>'frequency') = 'monthly' THEN
                start_date + (INTERVAL '1 month' * (generate_series * (recurrence_pattern->>'interval')::integer)) <= end_date
                AND generate_series < COALESCE((recurrence_pattern->>'occurrences')::integer, 730)
                AND EXTRACT(DAY FROM start_date + (INTERVAL '1 month' * (generate_series * (recurrence_pattern->>'interval')::integer))) = 
                    COALESCE((recurrence_pattern->>'dayOfMonth')::integer, EXTRACT(DAY FROM start_date))
            ELSE
                false
        END
)
SELECT * FROM expanded; 
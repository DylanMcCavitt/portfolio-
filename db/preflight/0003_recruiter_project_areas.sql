-- Read-only dry run for db/migrations/0003_recruiter_project_areas.sql.
-- A safe result is zero rows. Any row must be reviewed and mapped before apply.

SELECT source, project_ref, area, row_count
FROM (
  SELECT
    'projects'::text AS source,
    id || ' / ' || slug AS project_ref,
    area,
    count(*)::bigint AS row_count
  FROM projects
  WHERE area NOT IN ('Shipped & Client Work', 'Apps', 'AI & Developer Tools', 'Side Projects & Experiments', 'Coursework')
  GROUP BY id, slug, area

  UNION ALL

  SELECT
    'project_drafts'::text AS source,
    id AS project_ref,
    COALESCE(proposed_fields->>'area', (proposed_fields->'area')::text) AS area,
    count(*)::bigint AS row_count
  FROM project_drafts
  WHERE proposed_fields ? 'area'
    AND (
      jsonb_typeof(proposed_fields->'area') <> 'string'
      OR proposed_fields->>'area' NOT IN ('Shipped & Client Work', 'Apps', 'AI & Developer Tools', 'Side Projects & Experiments', 'Coursework')
    )
  GROUP BY id, proposed_fields->'area', proposed_fields->>'area'
) AS noncanonical
ORDER BY source, project_ref, area;

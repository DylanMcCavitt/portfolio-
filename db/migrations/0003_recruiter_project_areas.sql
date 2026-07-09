-- AGE-842: collapse project areas to the owner-approved recruiter-facing taxonomy.
-- Both updates are statement-idempotent so a partial Neon HTTP run converges on retry.

UPDATE projects AS project
SET area = mapping.new_area
FROM (
  VALUES
    ('bellas-beads', 'Shipped & Client Work'),
    ('nhf', 'Shipped & Client Work'),
    ('dog-log', 'Apps'),
    ('chore-ladder', 'Apps'),
    ('evalgate', 'AI & Developer Tools'),
    ('tradingview-mcp', 'AI & Developer Tools'),
    ('slurmlet', 'AI & Developer Tools'),
    ('agentic-trader', 'Side Projects & Experiments'),
    ('exit-manager', 'Side Projects & Experiments'),
    ('hood', 'Side Projects & Experiments'),
    ('condor-study', 'Side Projects & Experiments'),
    ('harness-arena', 'Side Projects & Experiments'),
    ('homeserver', 'Side Projects & Experiments'),
    ('work-orders', 'Coursework'),
    ('epl-ml', 'Coursework')
) AS mapping(project_ref, new_area)
WHERE (project.id = mapping.project_ref OR project.slug = mapping.project_ref)
  AND project.area IS DISTINCT FROM mapping.new_area;

UPDATE project_drafts AS draft
SET proposed_fields = jsonb_set(
  draft.proposed_fields,
  '{area}',
  to_jsonb(mapping.new_area),
  false
)
FROM (
  VALUES
    ('bellas-beads', 'Shipped & Client Work'),
    ('nhf', 'Shipped & Client Work'),
    ('dog-log', 'Apps'),
    ('chore-ladder', 'Apps'),
    ('evalgate', 'AI & Developer Tools'),
    ('tradingview-mcp', 'AI & Developer Tools'),
    ('slurmlet', 'AI & Developer Tools'),
    ('agentic-trader', 'Side Projects & Experiments'),
    ('exit-manager', 'Side Projects & Experiments'),
    ('hood', 'Side Projects & Experiments'),
    ('condor-study', 'Side Projects & Experiments'),
    ('harness-arena', 'Side Projects & Experiments'),
    ('homeserver', 'Side Projects & Experiments'),
    ('work-orders', 'Coursework'),
    ('epl-ml', 'Coursework')
) AS mapping(project_ref, new_area)
WHERE draft.proposed_fields ? 'area'
  AND (
    draft.proposed_project_id = mapping.project_ref
    OR draft.proposed_fields->>'id' = mapping.project_ref
    OR draft.proposed_fields->>'slug' = mapping.project_ref
  )
  AND draft.proposed_fields->>'area' IS DISTINCT FROM mapping.new_area;

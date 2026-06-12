Read Phase $ARGUMENTS from docs/migration-audit.md.

Implement that phase only. Do not proceed to the next phase.

Steps:
1. Read the relevant phase section from docs/migration-audit.md
2. Identify the exact files and line ranges to extract using grep or sed
3. Implement the phase steps in order
4. After completing, confirm what was done and the new line count of index.html
5. Do NOT deploy — tell the user the changes are ready for review

If the phase involves extracting code from index.html, use the extractor agent pattern:
read the section, write the new file, splice it out of index.html, verify the seam.

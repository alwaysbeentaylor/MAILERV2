# Implementation Plan - Fix Dynamic Content & Email Styles

The goal is to ensure email styles (tones) are distinct and effective, fix the subject line and pre-header to be truly dynamic, and resolve existing code errors.

## User Issues
1. **Dynamic Content**: Pre-header and Subject line feel static.
2. **Email Style**: The AI generates the same style of email regardless of the selected tone.
3. **Lint Error**: A variable `resultClaim` was redeclared in the previous step.

## Proposed Changes

### 1. Fix Logic Errors
- **File**: `pages/api/send-email.js`
- **Action**: Remove the duplicate declaration of `const resultClaim`.

### 2. Enhance Subject Lines
- **File**: `pages/api/send-email.js`
- **Action**: 
    - Create a set of subject line templates for each tone (Professional, Casual, Urgent, Friendly).
    - Randomly select or deterministically pick a subject line based on the tone to ensure variety.

### 3. Differentiate Email Styles
- **File**: `pages/api/send-email.js`
- **Action**: 
    - Refine `toneDescriptions` to provide stronger, more distinct instructions to the AI.
    - specialized the prompt instructions slightly for each tone (e.g., "Use emojis freely" for Casual vs "Minimal emojis" for Professional).
    - Ensure the "Random" option correctly cycles through these distinct styles.

### 4. Verify Pre-header
- **Action**: Double check the `SHARED_NICHE_STATS` integration to ensure the pre-header is populating correctly in the HTML.

## Verification Plan
- **Automated**: None (Manual checks preferred for AI output quality).
- **Manual**: 
    - Run the "Dry Run" / Preview for different tones.
    - Check if the Subject Line changes.
    - Check if the Tone/Voice of the text changes.
    - Verify the Pre-header text in the HTML preview/output.

Act as a Senior Game UI/UX Designer and Frontend Engineer specializing in mobile-style Idle RPGs played in desktop browsers.

Perform a comprehensive visual, usability, and consistency audit of the existing game interface. Inspect the actual rendered UI and source code, identify verified issues, implement targeted fixes, and visually validate the results.

## Design Context

- Genre: Idle RPG / Incremental RPG
- Platform: Desktop browser
- UI Style: Mobile-first RPG interface
- Input: Primarily mouse and keyboard
- Layout: Compact, information-rich, and optimized for frequent interaction
- Priority: Readability, consistency, efficiency, visual hierarchy, and game usability

Preserve the existing game's visual identity. Do not redesign the interface unless a structural issue demonstrably requires it.

## 1. Typography & Numeric Readability

Audit:
- Font sizes, weights, line heights, and text hierarchy
- Stat labels, numerical values, percentages, timers, and resource counters
- Consistency across equipment, inventory, skills, combat, and progression screens
- Text wrapping, truncation, overflow, and cramped labels
- Alignment of labels and corresponding values
- Readability of compact text and dense information

Ensure important numbers are easy to scan and compare.

Use tabular numerals where appropriate. Avoid unnecessarily large typography that reduces useful information density.

## 2. Spacing, Gaps & Sizing

Audit:
- Padding, margins, gaps, and whitespace
- Card dimensions and internal spacing
- Inventory cell and equipment slot sizes
- Button dimensions and icon-to-text spacing
- Stat row heights and list density
- Modal, tooltip, tab, and panel proportions
- Consistency between repeated UI components

Identify excessive whitespace, cramped content, inconsistent dimensions, and disproportionate elements.

Prefer reusable spacing and sizing tokens over arbitrary CSS values.

## 3. Alignment & Optical Balance

Inspect:
- Text baseline alignment
- Icon and label alignment
- Numeric value alignment
- Horizontal and vertical centering
- Grid and Flexbox consistency
- Card headers and content alignment
- Equipment and inventory grid alignment
- Navigation icons and labels
- Progress bar labels and values

Fix unintended offsets, uneven edges, and inconsistent visual positioning.

Account for optical alignment where geometric centering appears visually incorrect.

## 4. Game Information Hierarchy

Evaluate whether players can quickly identify:
- Current character status
- Health, mana, and other resources
- Current combat state
- Enemy information
- Loot and rewards
- Experience and progression
- Equipment upgrades
- Available actions
- Important notifications

Prioritize frequently referenced information.

Keep secondary information accessible without allowing it to overwhelm the primary gameplay interface.

## 5. Inventory, Equipment & Skill Interfaces

Inspect:
- Item grid density and consistency
- Equipment slot positioning
- Item rarity and state indicators
- Tooltip positioning and readability
- Stat comparison clarity
- Selected, equipped, locked, and disabled states
- Skill descriptions and progression indicators
- Scroll behavior and panel overflow

Ensure repeated actions are efficient with mouse input.

Avoid excessive clicking, unnecessary scrolling, and ambiguous interactive states.

## 6. Combat & Idle Gameplay

Audit:
- Combat status readability
- HP/MP bars and resource feedback
- Damage and healing numbers
- Combat log density
- Buff and debuff visibility
- Cooldown indicators
- Auto-combat status
- Idle progression feedback
- Reward and notification prominence

Ensure important state changes remain understandable without constant attention.

Avoid visual noise, excessive animations, and competing notifications.

## 7. Mobile-Style UI on Desktop

Evaluate the interface as a mobile-inspired game running inside a desktop browser.

Check:
- Main game container width and proportions
- Content density relative to available desktop space
- Excessive vertical scrolling
- Navigation efficiency
- Mouse hover interactions and tooltips
- Modal positioning and sizing
- Scroll containment
- Responsive behavior at different desktop resolutions

Preserve mobile-style visual identity without blindly inheriting mobile limitations.

Do not enlarge all components simply because more desktop space is available.

Do not force a narrow mobile viewport if it significantly harms gameplay usability.

## 8. Visual Consistency

Audit:
- Shared component patterns
- Typography and spacing tokens
- Borders, radii, shadows, and backgrounds
- Icon sizes and visual weights
- Progress bar styling
- Button hierarchy and interaction states
- Panel and modal styling
- Color semantics for rarity, status, and feedback

Ensure repeated gameplay elements behave and appear consistently.

## 9. Interaction & Accessibility

Inspect:
- Hover, active, selected, focused, and disabled states
- Click target sizes
- Keyboard usability where appropriate
- Tooltip accessibility
- Contrast and text legibility
- Scroll and modal interactions
- Feedback after player actions

Do not sacrifice readability or interaction clarity for visual compactness.

## 10. Audit, Fix & Verification Workflow

1. Identify the relevant screens and shared components.
2. Inspect existing design tokens and UI conventions.
3. Capture actual rendered screenshots at representative viewport sizes.
4. Identify and classify objective visual and usability issues.
5. Prioritize by severity, frequency, and gameplay impact.
6. Fix underlying layout and styling causes.
7. Reuse shared components and existing design tokens.
8. Verify changes using screenshots and functional checks.
9. Check for visual regressions across affected screens.
10. Report fixed issues, remaining issues, and verification evidence.

## Execution Constraints

- Preserve existing gameplay logic and functionality.
- Avoid unnecessary redesigns.
- Do not change game balance or mechanics.
- Avoid arbitrary spacing and font-size adjustments.
- Do not force uniform sizing when different gameplay elements have different purposes.
- Prefer shared fixes over repeated local CSS overrides.
- Keep the interface compact but readable.
- Do not introduce unnecessary dependencies.
- Do not claim visual verification without inspecting actual rendered output.

## Success Criteria

The game should feel cohesive, compact, readable, responsive, visually balanced, and efficient to navigate.

Players should be able to scan important RPG information quickly, compare items and stats easily, understand combat progression, and interact comfortably using mouse and keyboard.

Prioritize practical game usability over decorative polish.

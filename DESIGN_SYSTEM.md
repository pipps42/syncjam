# SyncJam Design System
## Source of Truth for UI/UX Design

**Last Updated:** 2025-01-19
**Version:** 1.0.0

---

## Table of Contents

1. [Design Philosophy](#design-philosophy)
2. [Color Palette](#color-palette)
3. [Typography](#typography)
4. [Spacing System](#spacing-system)
5. [Components Library](#components-library)
6. [Icons](#icons)
7. [Layout Patterns](#layout-patterns)
8. [Animations & Transitions](#animations--transitions)
9. [Responsive Design](#responsive-design)
10. [Accessibility](#accessibility)
11. [CSS Variables Reference](#css-variables-reference)

---

## Design Philosophy

### Core Principles

1. **Dark-First Design**: Professional dark theme optimized for extended listening sessions
2. **Vibrant Accents**: Cyan and magenta gradients create energy and visual interest
3. **Mobile-First**: Optimized for mobile devices, enhanced for desktop
4. **Consistent & Predictable**: Reusable components with consistent behavior
5. **Accessibility**: WCAG 2.1 AA compliant color contrast and focus states

### Visual Language

- **Modern & Clean**: Minimalist design with generous whitespace
- **Depth & Hierarchy**: Subtle shadows and elevations create visual layers
- **Smooth Interactions**: Gentle animations enhance user experience
- **Professional Icons**: Vector icons instead of emoji for scalability

---

## Color Palette

### Primary Colors

```css
/* Backgrounds */
--bg-dark: #1a1a2e          /* Main background */
--bg-darker: #16161d        /* Deeper background */
--bg-elevated: #252538      /* Cards, elevated surfaces */

/* Accent Colors */
--primary-cyan: #00d9ff     /* Primary actions, links, highlights */
--primary-magenta: #ff006e  /* Secondary accents, gradients */

/* Gradients */
--gradient-primary: linear-gradient(135deg, #00d9ff 0%, #ff006e 100%)
--gradient-subtle: linear-gradient(135deg, rgba(0, 217, 255, 0.1) 0%, rgba(255, 0, 110, 0.1) 100%)
```

### Text Colors

```css
--text-primary: #f8f9fa     /* Headings, important text */
--text-secondary: #cbd5e1   /* Body text, descriptions */
--text-disabled: #64748b    /* Disabled states, hints */
```

### Semantic Colors

```css
--success: #22c55e          /* Success states, online status */
--warning: #f59e0b          /* Warning states, alerts */
--error: #ef4444            /* Error states, destructive actions */
--info: #3b82f6             /* Informational messages */

--spotify-green: #1db954    /* Spotify brand color */
```

### UI Colors

```css
--border-color: #2d2d44     /* Borders, dividers */
--shadow-color: rgba(0, 0, 0, 0.3)  /* Shadow base color */
```

### Usage Guidelines

- **DO**: Use `--bg-elevated` for cards and modals on top of `--bg-dark`
- **DO**: Use gradients sparingly for key CTAs and headers
- **DO**: Maintain minimum 4.5:1 contrast ratio for text
- **DON'T**: Use pure black (#000) or pure white (#fff) for backgrounds
- **DON'T**: Mix more than 3 colors in a single component

---

## Typography

### Font Family

```css
--font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto,
             'Helvetica Neue', Arial, sans-serif
--font-mono: 'Courier New', Consolas, Monaco, monospace
```

### Type Scale

```css
--text-xs: 0.75rem      /* 12px - Captions, badges */
--text-sm: 0.875rem     /* 14px - Secondary text, labels */
--text-base: 1rem       /* 16px - Body text, default */
--text-lg: 1.125rem     /* 18px - Subheadings */
--text-xl: 1.25rem      /* 20px - Card titles */
--text-2xl: 1.5rem      /* 24px - Section headings */
--text-3xl: 1.875rem    /* 30px - Page titles */
--text-4xl: 2.25rem     /* 36px - Hero headings */
```

### Font Weights

```css
--font-normal: 400      /* Body text */
--font-medium: 500      /* Emphasized text */
--font-semibold: 600    /* Subheadings */
--font-bold: 700        /* Headings */
--font-extrabold: 800   /* Hero text */
```

### Line Heights

```css
--leading-tight: 1.25   /* Headings */
--leading-normal: 1.5   /* Body text */
--leading-relaxed: 1.75 /* Long-form content */
```

### Usage Guidelines

- **Headings**: Use `--font-bold` or `--font-extrabold` with negative letter-spacing (-0.01em to -0.02em)
- **Body Text**: Always use `--text-base` or larger for readability
- **Labels**: `--text-sm` with `--font-semibold` and uppercase transform
- **Code/Room Codes**: Use `--font-mono` with increased letter-spacing (0.1em)

---

## Spacing System

### 4pt/8pt Grid System

```css
--space-1: 0.25rem   /* 4px */
--space-2: 0.5rem    /* 8px */
--space-3: 0.75rem   /* 12px */
--space-4: 1rem      /* 16px */
--space-6: 1.5rem    /* 24px */
--space-8: 2rem      /* 32px */
--space-10: 2.5rem   /* 40px */
--space-12: 3rem     /* 48px */
--space-16: 4rem     /* 64px */
```

### Usage Guidelines

- **Component Padding**: Use `--space-4` to `--space-8` for cards and containers
- **Element Spacing**: Use `--space-2` to `--space-4` for gap between elements
- **Section Spacing**: Use `--space-8` to `--space-16` between major sections
- **Tight Spacing**: Use `--space-1` only for badges, tags, and inline elements

### Examples

```css
/* Card padding */
padding: var(--space-6);

/* Button gap between icon and text */
gap: var(--space-2);

/* Margin between sections */
margin-top: var(--space-12);
```

---

## Components Library

### Button Component

**File**: `src/components/common/Button.tsx`

#### Variants

1. **Primary** - Main CTAs, important actions
   - Background: `--gradient-primary`
   - Text: `white`
   - Use: "Create Room", "Join Room", form submissions

2. **Secondary** - Alternative actions
   - Background: `--bg-elevated`
   - Text: `--text-primary`
   - Border: `--border-color`
   - Use: "Cancel", navigation, less important actions

3. **Ghost** - Tertiary actions
   - Background: `transparent`
   - Text: `--primary-cyan`
   - Hover: subtle background
   - Use: "Sign in", inline links, tertiary actions

4. **Danger** - Destructive actions
   - Background: `rgba(239, 68, 68, 0.1)`
   - Text: `--error`
   - Border: `rgba(239, 68, 68, 0.3)`
   - Use: "Delete", "Leave Room", "Terminate"

5. **Spotify** - Spotify-specific actions
   - Background: `--spotify-green`
   - Text: `white`
   - Use: "Sign in with Spotify", Spotify OAuth

#### Sizes

```tsx
size="sm"   // Small buttons (secondary actions)
size="md"   // Default size (most common)
size="lg"   // Large buttons (hero CTAs)
```

#### States

- **Loading**: Shows spinner, disables interaction
- **Disabled**: 60% opacity, no pointer events
- **Hover**: Slight lift (translateY(-2px)) + enhanced shadow
- **Active**: Scale down (0.95)

#### Usage Example

```tsx
<Button variant="primary" size="lg" isLoading={isSubmitting}>
  Create Room
</Button>

<Button variant="danger" icon={<DoorOpen size={16} />} onClick={handleLeave}>
  Leave Room
</Button>
```

---

### Avatar Component

**File**: `src/components/common/Avatar.tsx`

#### Sizes

```tsx
size="sm"   // 32px - Inline mentions, compact lists
size="md"   // 40px - Participant lists, cards
size="lg"   // 48px - Profile headers
size="xl"   // 64px - Hero sections
```

#### Variants

```tsx
variant="circle"  // Default, for user avatars
variant="square"  // Rounded squares for brands/rooms
```

#### Fallback Behavior

1. If `src` provided and loads → show image
2. If `src` fails or not provided → show initials from `name`
3. If no `name` → show "?" placeholder

#### Gradient Background

Initials are displayed on gradient background for visual consistency:
```css
background: var(--gradient-primary)
```

#### Usage Example

```tsx
<Avatar
  src={user.spotify_user.images[0]?.url}
  name={user.display_name}
  size="md"
/>
```

---

### Badge Component

**File**: `src/components/common/Badge.tsx`

#### Variants

1. **Success** - Green, for active/online states
2. **Error** - Red, for inactive/offline states
3. **Warning** - Yellow, for alerts
4. **Info** - Blue, for informational tags
5. **Premium** - Gold gradient, for Spotify Premium
6. **Default** - Neutral gray, general purpose

#### Sizes

```tsx
size="sm"  // Compact badges for inline use
size="md"  // Standard badges
```

#### Usage Example

```tsx
<Badge variant="success">Active</Badge>
<Badge variant="premium" size="sm">Premium</Badge>
<Badge variant="info">{roomCount}</Badge>
```

---

### Card Component

**File**: `src/components/common/Card.tsx`

#### Variants

1. **Default** - Standard card with border
   ```css
   background: var(--bg-elevated)
   border: 1px solid var(--border-color)
   ```

2. **Elevated** - Card with shadow, no border
   ```css
   box-shadow: var(--shadow-lg)
   ```

3. **Gradient** - Card with gradient border
   ```css
   border: 1px solid transparent
   background-image: gradient + background-color
   ```

#### Padding Options

```tsx
padding="none"  // No padding (0)
padding="sm"    // Small (--space-4)
padding="md"    // Medium (--space-6) - Default
padding="lg"    // Large (--space-8)
```

#### Hoverable

```tsx
hoverable={true}  // Adds lift effect on hover
```

#### Usage Example

```tsx
<Card variant="elevated" padding="lg" hoverable>
  <h3>Room Name</h3>
  <p>Room details...</p>
</Card>
```

---

## Icons

### Icon Library

**Library**: [lucide-react](https://lucide.dev)
**Version**: ^0.546.0

### Core Icons Used

| Icon | Component | Usage |
|------|-----------|-------|
| 👑 → `<Crown />` | Host Badge | Indicates room host |
| 🎵 → `<Music />` | Queue, Features | Music-related actions |
| 👥 → `<Users />` | Participants | User lists, counts |
| 🔗 → `<Share2 />` | Share | Share room links |
| ✕ → `<X />` | Close, Errors | Dismiss, delete actions |
| ⚠️ → `<AlertTriangle />` | Warnings | Alert messages |
| 🔍 → `<Search />` | Search | Search functionality |
| 💬 → `<MessageCircle />` | Chat | Chat/messaging |
| 🎧 → `<Headphones />` | Audio | Streaming features |
| ℹ️ → `<Info />` | Information | Info messages |
| 🚪 → `<DoorOpen />` | Leave/Exit | Exit room, logout |
| 🔄 → `<RefreshCw />` | Retry | Refresh, retry actions |
| ❌ → `<AlertCircle />` | Errors | Error states |

### Icon Sizing

```tsx
// Small icons (inline with text)
<Icon size={14} />  // Badges, inline text

// Medium icons (default)
<Icon size={16} />  // Buttons, labels
<Icon size={20} />  // Headers, cards
<Icon size={24} />  // Navigation tabs

// Large icons (hero elements)
<Icon size={32} />  // Feature highlights
<Icon size={48} />  // Empty states
<Icon size={64} />  // Hero sections
```

### Color Classes

```tsx
// Inherit from parent
<Icon className="icon-inherit" />

// Specific colors
<Icon className="icon-primary" />    // Cyan
<Icon className="icon-success" />    // Green
<Icon className="icon-error" />      // Red
<Icon className="icon-warning" />    // Yellow
```

### Usage Guidelines

- **ALWAYS** use lucide-react icons, **NEVER** use emoji in production UI
- Icons should be the same color as adjacent text for consistency
- Use `size` prop for icon dimensions, not CSS width/height
- Maintain 16px minimum size for accessibility
- Add descriptive `aria-label` when icon is the only content in a button

---

## Layout Patterns

### Page Container

```css
.page-container {
  min-height: 100vh;
  background: var(--bg-dark);
  padding: var(--space-4);
}
```

### Content Width

```css
.content-wrapper {
  max-width: 1200px;  /* Desktop */
  max-width: 768px;   /* Tablet */
  max-width: 480px;   /* Mobile */
  margin: 0 auto;
  width: 100%;
}
```

### Grid Layouts

```css
/* Card Grid */
.grid-cards {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: var(--space-6);
}

/* Equal Columns */
.grid-2-col {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-4);
}
```

### Flex Patterns

```css
/* Horizontal Stack */
.flex-row {
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

/* Vertical Stack */
.flex-col {
  display: flex;
  flex-direction: column;
  gap: var(--space-4);
}

/* Space Between */
.flex-between {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
```

---

## Animations & Transitions

### Transition Variables

```css
--transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1)
--transition-all: all 200ms cubic-bezier(0.4, 0, 0.2, 1)
```

### Common Animations

#### Slide Up (Page Entry)

```css
@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.slide-up {
  animation: slideUp 0.5s ease-out;
}
```

#### Slide Down (Banners, Toasts)

```css
@keyframes slideDown {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

#### Shake (Errors)

```css
@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-5px); }
  75% { transform: translateX(5px); }
}

.shake {
  animation: shake 0.3s ease-out;
}
```

#### Spinner

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 0.8s linear infinite;
}
```

### Interaction States

```css
/* Button Hover */
.button:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
  transition: var(--transition-base);
}

/* Button Active */
.button:active {
  transform: scale(0.95);
}

/* Card Hover */
.card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-xl);
}
```

### Usage Guidelines

- Use `transform` instead of `top/left` for performance
- Keep animations under 500ms for snappy feel
- Disable animations for `prefers-reduced-motion`
- Use cubic-bezier easing for natural movement

---

## Responsive Design

### Breakpoints

```css
/* Mobile First Approach */
/* Default: Mobile (< 768px) */

@media (min-width: 768px) {
  /* Tablet */
}

@media (min-width: 1024px) {
  /* Desktop */
}

@media (min-width: 1280px) {
  /* Large Desktop */
}
```

### Mobile Considerations

- **Touch Targets**: Minimum 44px × 44px for buttons
- **Safe Areas**: Use `env(safe-area-inset-*)` for iOS
- **Viewport Heights**: Use `100dvh` instead of `100vh` on mobile
- **Font Sizes**: Never go below 14px (0.875rem) on mobile

### Responsive Typography

```css
/* Mobile */
h1 { font-size: var(--text-2xl); }

/* Desktop */
@media (min-width: 768px) {
  h1 { font-size: var(--text-4xl); }
}
```

### Responsive Spacing

```css
/* Mobile */
.section { padding: var(--space-4); }

/* Desktop */
@media (min-width: 768px) {
  .section { padding: var(--space-8); }
}
```

---

## Accessibility

### Color Contrast

- **Normal Text**: Minimum 4.5:1 contrast ratio
- **Large Text** (18px+): Minimum 3:1 contrast ratio
- **UI Components**: Minimum 3:1 contrast against adjacent colors

### Focus States

```css
/* Default Focus Ring */
:focus {
  outline: 2px solid var(--primary-cyan);
  outline-offset: 2px;
}

/* Custom Focus for Inputs */
input:focus {
  border-color: var(--primary-cyan);
  box-shadow: 0 0 0 3px rgba(0, 217, 255, 0.1);
}
```

### Keyboard Navigation

- All interactive elements must be keyboard accessible
- Maintain logical tab order
- Provide skip links for main content
- Support Escape key to close modals

### Screen Readers

- Use semantic HTML (`<button>`, `<nav>`, `<main>`)
- Add `aria-label` for icon-only buttons
- Use `aria-live` for dynamic content updates
- Provide alt text for all images

### Motion Preferences

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## CSS Variables Reference

### Complete Variable List

```css
:root {
  /* Colors - Background */
  --bg-dark: #1a1a2e;
  --bg-darker: #16161d;
  --bg-elevated: #252538;

  /* Colors - Primary */
  --primary-cyan: #00d9ff;
  --primary-magenta: #ff006e;

  /* Colors - Text */
  --text-primary: #f8f9fa;
  --text-secondary: #cbd5e1;
  --text-disabled: #64748b;

  /* Colors - Semantic */
  --success: #22c55e;
  --warning: #f59e0b;
  --error: #ef4444;
  --info: #3b82f6;
  --spotify-green: #1db954;

  /* Colors - UI */
  --border-color: #2d2d44;

  /* Gradients */
  --gradient-primary: linear-gradient(135deg, #00d9ff 0%, #ff006e 100%);

  /* Typography - Family */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
  --font-mono: 'Courier New', Consolas, Monaco, monospace;

  /* Typography - Size */
  --text-xs: 0.75rem;
  --text-sm: 0.875rem;
  --text-base: 1rem;
  --text-lg: 1.125rem;
  --text-xl: 1.25rem;
  --text-2xl: 1.5rem;
  --text-3xl: 1.875rem;
  --text-4xl: 2.25rem;

  /* Typography - Weight */
  --font-normal: 400;
  --font-medium: 500;
  --font-semibold: 600;
  --font-bold: 700;
  --font-extrabold: 800;

  /* Typography - Line Height */
  --leading-tight: 1.25;
  --leading-normal: 1.5;
  --leading-relaxed: 1.75;

  /* Spacing */
  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-10: 2.5rem;
  --space-12: 3rem;
  --space-16: 4rem;

  /* Border Radius */
  --radius-sm: 0.25rem;
  --radius-md: 0.5rem;
  --radius-lg: 0.75rem;
  --radius-xl: 1rem;
  --radius-2xl: 1.5rem;
  --radius-full: 9999px;

  /* Shadows */
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
  --shadow-md: 0 4px 6px rgba(0, 0, 0, 0.1);
  --shadow-lg: 0 10px 15px rgba(0, 0, 0, 0.15);
  --shadow-xl: 0 20px 25px rgba(0, 0, 0, 0.2);
  --shadow-2xl: 0 25px 50px rgba(0, 0, 0, 0.25);

  /* Transitions */
  --transition-fast: 150ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-base: 200ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-slow: 300ms cubic-bezier(0.4, 0, 0.2, 1);
  --transition-all: all 200ms cubic-bezier(0.4, 0, 0.2, 1);

  /* Z-Index Scale */
  --z-dropdown: 1000;
  --z-sticky: 1020;
  --z-fixed: 1030;
  --z-modal-backdrop: 1040;
  --z-modal: 1050;
  --z-popover: 1060;
  --z-tooltip: 1070;
}
```

---

## File Structure

```
src/
├── styles/
│   └── theme.css              # Design system variables (SOURCE OF TRUTH)
│
├── components/
│   ├── common/                # Reusable UI components
│   │   ├── index.ts           # Export all common components
│   │   ├── Button.tsx         # Button component
│   │   ├── Button.css         # Button styles
│   │   ├── Avatar.tsx         # Avatar component
│   │   ├── Avatar.css         # Avatar styles
│   │   ├── Badge.tsx          # Badge component
│   │   ├── Badge.css          # Badge styles
│   │   ├── Card.tsx           # Card component
│   │   └── Card.css           # Card styles
│   │
│   ├── Home.tsx               # Homepage
│   ├── Home.css
│   ├── MyRoomBanner.tsx       # Room banner
│   ├── MyRoomBanner.css
│   ├── PublicRoomsList.tsx    # Public rooms list
│   ├── PublicRoomsList.css
│   │
│   ├── auth/
│   │   ├── Login.tsx          # Login page
│   │   └── Login.css
│   │
│   └── room/
│       ├── CreateRoom.tsx     # Create room form
│       ├── CreateRoom.css
│       ├── JoinRoom.tsx       # Join room form
│       ├── JoinRoom.css
│       ├── RoomView.tsx       # Room view
│       └── RoomViewMobile.css
```

---

## Best Practices

### Component Development

1. **Always use CSS variables** from theme.css
2. **Import common components** instead of creating custom buttons/badges
3. **Use lucide-react icons** instead of emoji
4. **Follow mobile-first** responsive design
5. **Test with keyboard navigation** and screen readers

### CSS Guidelines

1. **Use CSS variables** for all colors, spacing, and typography
2. **Avoid magic numbers** - use spacing scale
3. **Use semantic class names** (`.card-header` not `.pt-4-flex`)
4. **Scope styles** to component files
5. **Avoid !important** - fix specificity instead

### Component Naming

```tsx
// ✅ Good
<Button variant="primary" size="lg">Submit</Button>
<Badge variant="success">Online</Badge>

// ❌ Bad
<button className="btn-primary-lg">Submit</button>
<span className="badge-green">Online</span>
```

### Accessibility Checklist

- [ ] Semantic HTML elements used
- [ ] Color contrast meets WCAG AA standards
- [ ] Focus states visible on all interactive elements
- [ ] Keyboard navigation works
- [ ] ARIA labels on icon-only buttons
- [ ] Alt text on images
- [ ] Reduced motion respected

---

## Version History

### v1.0.0 (2025-01-19)
- Initial design system documentation
- Dark theme color palette
- Typography scale and spacing system
- Common components library (Button, Avatar, Badge, Card)
- Icon system with lucide-react
- Responsive design guidelines
- Accessibility standards

---

## Contributing

When adding new components or modifying the design system:

1. **Update this document** with any new patterns or components
2. **Follow existing conventions** for naming and structure
3. **Test on mobile and desktop** breakpoints
4. **Verify accessibility** with keyboard and screen reader
5. **Update version number** and changelog

---

## Support

For questions about the design system:
- Review this document first
- Check existing components in `src/components/common/`
- Reference `src/styles/theme.css` for all variables
- Test implementation in isolation before integration

---

**Document Maintained By**: Development Team
**Last Review**: 2025-01-19
**Next Review**: Quarterly or on major updates

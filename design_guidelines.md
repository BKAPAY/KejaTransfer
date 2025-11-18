# KEJAtransfer Design Guidelines

## Design Approach: Material Design System
**Rationale**: Financial applications require trust, clarity, and data-dense interfaces. Material Design provides excellent patterns for forms, data visualization, and transactional interfaces essential for payment platforms.

## Typography Hierarchy

**Font Families** (Google Fonts via CDN):
- Primary: Inter (400, 500, 600, 700) - UI, body text, buttons
- Accent: DM Sans (500, 600) - Headers, statistics, amounts

**Type Scale**:
- Page Titles: text-3xl/font-bold (Dashboard, Profile)
- Section Headers: text-xl/font-semibold (Statistics cards, form sections)
- Card Titles: text-lg/font-medium (Payment links, transaction items)
- Body Text: text-base/font-normal (Forms, descriptions)
- Labels: text-sm/font-medium (Form fields, metadata)
- Captions: text-xs (Timestamps, helper text)
- Currency Amounts: text-2xl/font-bold (Dashboard stats), text-lg/font-semibold (transaction amounts)

## Spacing System

**Tailwind Primitives**: Consistent use of 4, 6, 8, 12, 16, 24 units
- Component padding: p-6
- Card spacing: p-8
- Section margins: mb-12
- Form field gaps: space-y-4
- Grid gaps: gap-6
- Page containers: px-4 md:px-8, max-w-7xl

## Layout Architecture

### Landing Page
- **Hero Section** (90vh): Full-width with large heading, subheading emphasizing "Mobile Money for West Africa", dual CTAs (S'inscrire/Se connecter), subtle overlay for text readability
- **Trust Indicators** (auto-height): 2-column grid showing supported countries (flags + names: 🇧🇯 Bénin, 🇹🇬 Togo, 🇨🇮 Côte d'Ivoire, 🇸🇳 Sénégal, 🇧🇫 Burkina Faso, 🇲🇱 Mali)
- **Features Section** (py-24): 3-column grid showcasing payment links, merchant links, API gateway with icons and descriptions
- **Mobile Money Operators** (py-20): Multi-column grid displaying operator logos (Orange Money, MTN, Moov, Wave, Free Money, T-Money, etc.)
- **CTA Section** (py-16): Centered "Commencer maintenant" with supporting text
- **Footer**: 3-column layout (Company info, Quick links, Support), copyright, legal links

### Authentication Pages
**Layout**: Centered card (max-w-md) with logo above, form inside elevated card component
- **Sign Up Form**: Vertical stack with fields (Nom, Prénom, Gmail, Mot de passe, Confirmer le mot de passe), primary button, link to login
- **Login Form**: Gmail, Mot de passe fields, "Mot de passe oublié?" link below, primary button, link to sign up

### Dashboard Layout
**Structure**: Sidebar + main content area
- **Sidebar** (fixed, w-64): Logo at top, navigation menu with icons, déconnexion at bottom
- **Main Content** (flex-1, ml-64): Top bar with page title, content area with max-w-7xl

**Dashboard Home**:
- **Stats Cards** (grid-cols-3, gap-6): Solde total, Dépôt, Transfert - each card with large amount (XOF), label, trend indicator
- **Recent Activity**: Table/list showing recent transactions with status badges

### Navigation Menu (Sidebar)
Vertical list with consistent spacing (space-y-2), each item: icon (left) + label, hover state, active indicator

Menu Items: Profil, Lien de paiement, Lien marchand, API, Historique, Paramètres, Annonces, Documentation, Support, Déconnexion

### Payment Link Generator
**Form Layout** (max-w-2xl):
- Form fields in vertical stack (space-y-6)
- Image upload with preview area
- Generated link display with copy button
- Preview card showing how payment page will appear

### Payment Collection Interface (Public)
**Centered Layout** (max-w-lg):
- Product image (if provided) at top, rounded corners
- Product name (text-2xl/font-bold), description below
- Amount display (XOF, prominent)
- Form fields: Nom, Prénom, Gmail, country selector (with flags), phone number, operator selector (dropdown with logos)
- Primary payment button

### Merchant Link Interface
Similar to payment link but with editable amount field for customer input

### API Section
**Layout**: Documentation-style with code examples
- API key display cards with copy buttons, visibility toggle
- Integration guide sections
- Webhook configuration form

### Transaction History
**Table Layout**: 
- Filters bar at top (date range, status, country)
- Data table with columns: Date/Time, Description, Amount, Status, Country/Operator
- Status badges (completed/pending/failed)
- Pagination controls

## Component Library

### Cards
Elevated surface (shadow-md), rounded-lg, p-6, border subtle, hover:shadow-lg transition

### Forms
- Input fields: Full-width, py-3, px-4, rounded-md, border, focus ring
- Labels: Above inputs, text-sm/font-medium, mb-2
- Country/Operator selectors: Dropdown with flag/logo icons
- Error states: Red border, error message text-sm below

### Buttons
- Primary: Large hit area, px-6 py-3, rounded-md, font-semibold
- Secondary: Outlined variant
- Icon buttons: Square, p-3, for actions like copy

### Status Badges
Rounded-full, px-3 py-1, text-xs/font-medium, distinct variants for success/pending/error

### Navigation
- Active state: Slightly elevated background, indicator bar (left)
- Hover: Subtle background change

### Data Display
- Stat cards: Large number centered, label below, icon optional
- Transaction items: Flex layout with icon, details (flex-1), amount (right-aligned)

### Modals/Overlays
Centered overlay (max-w-md to max-w-2xl depending on content), backdrop blur

## Icons
**Library**: Heroicons via CDN
- Navigation icons (outline style)
- Status indicators (solid style)
- Form actions (outline style)

## Responsive Behavior

**Mobile** (< 768px):
- Sidebar becomes slide-out drawer with hamburger toggle
- Stats cards stack vertically (grid-cols-1)
- Tables become scrollable horizontally or card-based list
- Form fields full-width with comfortable touch targets (min-height: 48px)
- Text scales down appropriately (text-2xl → text-xl for headings)

**Tablet** (768px - 1024px):
- 2-column grids for features/stats
- Sidebar remains visible but narrower

**Desktop** (> 1024px):
- 3-column layouts for features/stats
- Full sidebar with labels
- Optimal reading width for forms (max-w-2xl)

## Images

**Hero Image**: Full-width background image showing diverse African professionals using mobile phones for payments, overlay gradient for text legibility

**Payment Link Interface**: User-uploaded product images displayed prominently (aspect-ratio-square or 16:9), rounded corners, max-height constraint

**Landing Page**: Operator logos displayed as small badges in grid format, country flags as inline icons with country names

**Dashboard**: Optional placeholder illustrations for empty states (no transactions yet)

All images: Lazy loading, responsive with object-fit-cover, appropriate alt text for accessibility
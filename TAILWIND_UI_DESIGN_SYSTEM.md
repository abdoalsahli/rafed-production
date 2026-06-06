# Tailwind UI Design System - Prepaid Card Platform

## Design Direction
- **Style**: Tailwind UI (clean B2B SaaS)
- **Category**: Enterprise Dashboard
- **Approach**: Table-heavy, professional, minimal
- **Localization**: RTL-ready, Arabic-friendly

## Color Palette

### Semantic Colors
- **Primary**: Blue-600 (actions, active states)
- **Success**: Green-600 (completed, positive)
- **Warning**: Amber-600 (pending, caution)
- **Danger**: Red-600 (errors, destructive)
- **Neutral**: Gray-500 (secondary text), Gray-900 (primary text)

### Background Colors
- **Page**: Gray-50 (light background)
- **Card**: White
- **Sidebar**: Gray-900 (dark)
- **Hover**: Gray-100

## Typography

### Headings
- **Page Title**: text-3xl font-bold text-gray-900
- **Section Title**: text-xl font-semibold text-gray-900
- **Subsection**: text-lg font-semibold text-gray-900

### Body Text
- **Primary**: text-sm text-gray-900
- **Secondary**: text-sm text-gray-600
- **Tertiary**: text-xs text-gray-500

## Components

### Sidebar
- Fixed right position, w-64
- Dark background (gray-900)
- Navigation items with hover states
- User info section at bottom
- Logout button (destructive)

### Headers
- Clean, minimal design
- Page title + breadcrumb
- Action buttons on the right
- Subtle border-bottom

### Cards
- White background
- Subtle shadow (shadow-sm)
- Rounded corners (rounded-lg)
- Consistent padding (p-6)
- Border: border-gray-200

### Tables
- Striped rows (alternate gray-50)
- Hover states (bg-gray-50)
- Clear column headers
- Compact spacing
- Action buttons in last column

### Forms
- Label: text-sm font-medium text-gray-900
- Input: border-gray-300, rounded-md
- Placeholder: text-gray-500
- Error: border-red-300, text-red-600
- Help text: text-xs text-gray-600

### Buttons
- **Primary**: bg-blue-600 hover:bg-blue-700 text-white
- **Secondary**: bg-white border border-gray-300 text-gray-900 hover:bg-gray-50
- **Destructive**: bg-red-600 hover:bg-red-700 text-white
- **Disabled**: opacity-50 cursor-not-allowed

### Badges
- **Success**: bg-green-100 text-green-800
- **Warning**: bg-amber-100 text-amber-800
- **Error**: bg-red-100 text-red-800
- **Info**: bg-blue-100 text-blue-800

### Loading States
- Skeleton loaders for tables/cards
- Spinner for async operations
- Subtle animation

### Empty States
- Icon + message
- Optional action button
- Centered, spacious layout

## Spacing
- **Sidebar padding**: p-6
- **Card padding**: p-6
- **Section gap**: gap-6
- **Item gap**: gap-4
- **Form fields**: space-y-4

## RTL Support
- Use `dir="rtl"` on root element
- Flexbox: flex-row-reverse for proper alignment
- Margin/padding: Use logical properties where possible
- Text alignment: text-right for RTL

## Implementation Guidelines

1. **Preserve Functionality**: All buttons, forms, and actions must work exactly as before
2. **Use Existing Components**: Leverage shadcn/ui components where available
3. **Consistent Styling**: Apply design system consistently across all pages
4. **Responsive Design**: Mobile-first approach with proper breakpoints
5. **Accessibility**: Maintain WCAG AA compliance
6. **No Mock Data**: Use real data from hooks/APIs
7. **No New Logic**: Only visual improvements

## Pages to Update (Priority Order)

1. UnifiedSidebar + Header
2. Admin: Organizations, Users
3. Provider: Products, Inventory, Upload
4. Distributor: Dashboard, Accounts, Transactions, API
5. Supporting components (cards, tables, forms, modals)

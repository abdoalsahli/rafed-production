# Stitch Integration: Critical Warnings & Checklist

## ⚠️ CRITICAL WARNINGS

### 1. Props Must Match Exactly
**Risk:** TypeScript errors, runtime crashes
**Action:** When replacing components, verify prop names and types match exactly.

**Example - WRONG:**
```typescript
// Old component
interface Props {
  onSubmit: (data: Organization) => Promise<void>;
}

// New Stitch component (WRONG)
interface Props {
  onSave: (data: Organization) => Promise<void>;  // ❌ Wrong prop name
}
```

**Example - CORRECT:**
```typescript
// New Stitch component (CORRECT)
interface Props {
  onSubmit: (data: Organization) => Promise<void>;  // ✓ Same prop name
}
```

---

### 2. No Business Logic in Components
**Risk:** Duplicate logic, inconsistent behavior, hard to maintain
**Action:** All data fetching, mutations, validation must stay in hooks.

**WRONG - Business logic in component:**
```typescript
export const OrganizationsTable = (props) => {
  const [organizations, setOrganizations] = useState([]);
  
  useEffect(() => {
    // ❌ WRONG: Fetching data in component
    trpc.admin.organizations.list.useQuery().then(data => {
      setOrganizations(data);
    });
  }, []);
  
  return <table>...</table>;
};
```

**CORRECT - Logic in hook:**
```typescript
// Hook
export function useOrganizations() {
  const { data, isLoading } = trpc.admin.organizations.list.useQuery();
  return { organizations: data || [], isLoading };
}

// Component (presentation only)
export const OrganizationsTable = ({ organizations, isLoading }) => {
  return <table>...</table>;
};
```

---

### 3. Hooks Are Read-Only
**Risk:** Breaking all pages using the hook
**Action:** Do not modify hook signatures or return types.

**WRONG - Modifying hook:**
```typescript
// ❌ WRONG: Changing return type
export function useOrganizations() {
  // Was: { organizations, isLoading, error }
  // Now: { data, loading, err }  ← BREAKS ALL PAGES
  return { data, loading, err };
}
```

**CORRECT - Keep hook unchanged:**
```typescript
// ✓ CORRECT: Hook signature stays the same
export function useOrganizations() {
  return { organizations, isLoading, error };
}
```

---

### 4. Callback Signatures Must Match
**Risk:** Buttons won't work, forms won't submit
**Action:** Keep all callback signatures identical.

**WRONG - Changing callback:**
```typescript
// Old component
interface Props {
  onEdit: (organization: Organization) => void;
}

// New Stitch component (WRONG)
interface Props {
  onEdit: (id: number) => void;  // ❌ Different parameter type
}
```

**CORRECT - Keep callbacks unchanged:**
```typescript
// New Stitch component (CORRECT)
interface Props {
  onEdit: (organization: Organization) => void;  // ✓ Same signature
}
```

---

### 5. Loading & Error States Required
**Risk:** UI appears broken during data fetch
**Action:** All components must accept and display isLoading and error props.

**WRONG - Ignoring loading state:**
```typescript
export const OrganizationsTable = ({ organizations }) => {
  // ❌ WRONG: No loading skeleton
  return <table>{organizations.map(...)}</table>;
};
```

**CORRECT - Handling loading state:**
```typescript
export const OrganizationsTable = ({ organizations, isLoading, error }) => {
  if (isLoading) return <LoadingSkeleton />;
  if (error) return <ErrorMessage error={error} />;
  return <table>{organizations.map(...)}</table>;
};
```

---

### 6. Data Types Must Be Preserved
**Risk:** Type mismatches, runtime errors
**Action:** Keep all data types (Date, enum, optional fields) exactly as defined.

**WRONG - Changing data type:**
```typescript
// Old interface
interface Organization {
  createdAt: Date;  // Date object
}

// New Stitch component (WRONG)
interface Organization {
  createdAt: string;  // ❌ String instead of Date
}
```

**CORRECT - Keep data types:**
```typescript
// New Stitch component (CORRECT)
interface Organization {
  createdAt: Date;  // ✓ Same type
}
```

---

### 7. Mobile Responsiveness Required
**Risk:** App breaks on mobile devices
**Action:** All Stitch components must be responsive (mobile-first design).

**Breakpoints to support:**
- Mobile: < 768px (md)
- Tablet: 768px - 1024px (lg)
- Desktop: > 1024px

**WRONG - Desktop-only layout:**
```typescript
return (
  <div className="flex gap-4">
    {/* ❌ WRONG: No mobile handling */}
    <Sidebar />
    <Content />
  </div>
);
```

**CORRECT - Responsive layout:**
```typescript
return (
  <div className="flex flex-col lg:flex-row gap-4">
    {/* ✓ CORRECT: Stacks on mobile, side-by-side on desktop */}
    <Sidebar />
    <Content />
  </div>
);
```

---

### 8. Accessibility Must Be Maintained
**Risk:** App unusable for people with disabilities
**Action:** Keep all ARIA labels, keyboard navigation, focus management.

**WRONG - Removing accessibility:**
```typescript
// ❌ WRONG: No ARIA labels
<button onClick={handleDelete}>Delete</button>

// ❌ WRONG: No keyboard support
<div onClick={handleClick}>Click me</div>
```

**CORRECT - Accessible components:**
```typescript
// ✓ CORRECT: ARIA label
<button onClick={handleDelete} aria-label="Delete organization">
  Delete
</button>

// ✓ CORRECT: Keyboard support
<button onClick={handleClick}>Click me</button>
```

---

### 9. Authentication Flow Untouched
**Risk:** Users can't log in, session breaks
**Action:** Do not modify OAuth flow, useAuth hook, or session management.

**WRONG - Modifying auth:**
```typescript
// ❌ WRONG: Changing auth hook
export function useAuth() {
  // Was: { user, isAuthenticated, logout }
  // Now: { currentUser, isLoggedIn, signOut }  ← BREAKS AUTH
  return { currentUser, isLoggedIn, signOut };
}
```

**CORRECT - Keep auth unchanged:**
```typescript
// ✓ CORRECT: Auth hook stays the same
export function useAuth() {
  return { user, isAuthenticated, logout };
}
```

---

### 10. Backend Endpoints Unchanged
**Risk:** API calls fail, data doesn't sync
**Action:** Do not modify, rename, or delete any tRPC procedures.

**WRONG - Renaming endpoint:**
```typescript
// ❌ WRONG: Changing endpoint name
// Was: trpc.admin.organizations.list
// Now: trpc.admin.getAllOrganizations  ← BREAKS ALL PAGES

export const adminRouter = router({
  getAllOrganizations: protectedProcedure.query(async () => {
    // ...
  }),
});
```

**CORRECT - Keep endpoints unchanged:**
```typescript
// ✓ CORRECT: Endpoint stays the same
export const adminRouter = router({
  organizations: router({
    list: protectedProcedure.query(async () => {
      // ...
    }),
  }),
});
```

---

## ✓ PRE-STITCH GENERATION CHECKLIST

Before generating Stitch designs, verify:

### Foundation Layer
- [ ] UnifiedSidebar props documented
- [ ] AuthenticatedLayout props documented
- [ ] Navigation items structure confirmed
- [ ] Mobile menu behavior preserved

### Admin Section
- [ ] OrganizationsTable props finalized
- [ ] OrganizationForm props finalized
- [ ] UsersTable props finalized
- [ ] Modal components props finalized
- [ ] useOrganizations hook signature confirmed
- [ ] useUsers hook signature confirmed

### Provider Section
- [ ] All 6 provider pages identified
- [ ] All 8 presentation components props documented
- [ ] All 6 provider hooks signature confirmed
- [ ] Product import/export flow preserved
- [ ] Inventory upload validation preserved
- [ ] Request approval workflow preserved

### Distributor Section
- [ ] All distributor pages identified
- [ ] All 8 presentation components props documented
- [ ] All 8 distributor hooks signature confirmed
- [ ] Purchase flow validation preserved
- [ ] Wallet transaction logic preserved
- [ ] Connection request workflow preserved

### General
- [ ] All TypeScript types exported
- [ ] All interfaces documented
- [ ] All callbacks documented
- [ ] All data types confirmed
- [ ] Mobile breakpoints identified
- [ ] Accessibility requirements listed
- [ ] Backend endpoints verified unchanged

---

## 🚀 STITCH GENERATION WORKFLOW

### Phase 1: Design Generation
1. Use STITCH_HANDOFF_GUIDE.md as specification
2. Generate screens for each section
3. Export components with exact prop interfaces
4. Verify TypeScript types match

### Phase 2: Component Export
1. Export Stitch components
2. Preserve prop names and types
3. Include loading/error states
4. Support responsive design

### Phase 3: Integration
1. Replace one component at a time
2. Run TypeScript check after each replacement
3. Test in browser
4. Verify all callbacks work
5. Check mobile responsiveness

### Phase 4: Validation
1. All pages load without errors
2. All data displays correctly
3. All buttons/forms work
4. Mobile responsive
5. No TypeScript errors
6. All tests pass

---

## 📋 INTEGRATION TESTING CHECKLIST

After replacing each component, verify:

- [ ] Component renders without errors
- [ ] Props are passed correctly
- [ ] Loading state displays
- [ ] Error state displays
- [ ] All callbacks work
- [ ] Mobile layout responsive
- [ ] Keyboard navigation works
- [ ] ARIA labels present
- [ ] No console errors
- [ ] TypeScript compiles

---

## 🆘 TROUBLESHOOTING

### TypeScript Error: "Property 'X' does not exist"
**Cause:** Prop name mismatch
**Fix:** Check STITCH_HANDOFF_GUIDE.md for exact prop name

### Button doesn't work
**Cause:** Callback signature mismatch
**Fix:** Verify callback parameters match interface

### Data doesn't display
**Cause:** Wrong prop name or type
**Fix:** Check hook return type in STITCH_HANDOFF_GUIDE.md

### Mobile layout broken
**Cause:** Missing responsive classes
**Fix:** Add Tailwind breakpoints (md:, lg:, etc.)

### Auth broken
**Cause:** Modified useAuth hook
**Fix:** Restore useAuth hook from git

---

## 📞 SUPPORT

If issues arise during Stitch integration:

1. Check STITCH_HANDOFF_GUIDE.md for prop contracts
2. Verify no business logic added to components
3. Confirm hooks unchanged
4. Check backend endpoints unchanged
5. Review STITCH_INTEGRATION_WARNINGS.md for common issues

---

**Status:** Ready for Stitch Design Generation ✓

All integration points documented. All warnings issued. All checklists prepared.

Proceed with confidence.

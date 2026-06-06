import { describe, it, expect, vi } from 'vitest';
import LoginPage from './LoginPage';

// Mock the getLoginUrl function
vi.mock('@/const', () => ({
  getLoginUrl: vi.fn(() => 'https://oauth.example.com/login'),
}));

describe('LoginPage', () => {
  it('should be a valid React component', () => {
    expect(LoginPage).toBeDefined();
    expect(typeof LoginPage).toBe('function');
  });

  it('should export a default component', () => {
    expect(LoginPage.name).toBe('LoginPage');
  });

  it('should have proper component structure', () => {
    const component = LoginPage.toString();

    // Check for key elements in JSX (Arabic UI)
    expect(component).toContain('منصة رافد');
    expect(component).toContain('سجّل دخولك للمتابعة');
    expect(component).toContain('الدخول بحساب Google');
    expect(component).toContain('البريد الإلكتروني');
    expect(component).toContain('أو باستخدام البريد الإلكتروني');
  });

  it('should handle state management for email', () => {
    const component = LoginPage.toString();
    
    // Check for useState hooks
    expect(component).toContain('useState');
  });

  it('should have OAuth login handler', () => {
    const component = LoginPage.toString();
    
    // Check for OAuth handler
    expect(component).toContain('handleOAuthLogin');
    expect(component).toContain('getLoginUrl');
  });

  it('should have form submission handler', () => {
    const component = LoginPage.toString();
    
    // Check for form submission
    expect(component).toContain('onSubmit');
    expect(component).toContain('preventDefault');
  });

  it('should have proper form inputs', () => {
    const component = LoginPage.toString();

    // Check for input types (compiled JSX uses object notation: type: "email")
    expect(component).toContain('"email"');
    expect(component).toContain('"checkbox"');
    expect(component).toContain('"password"');
  });

  it('should have navigation links', () => {
    const component = LoginPage.toString();

    // Check for links (Arabic UI)
    expect(component).toContain('نسيت كلمة المرور');
    expect(component).toContain('سجّل الآن');
    expect(component).toContain('/signup');
  });

  it('should have security messaging', () => {
    const component = LoginPage.toString();

    // Check for secure form elements (password input + error handling)
    expect(component).toContain('كلمة المرور');
    expect(component).toContain('فشل تسجيل الدخول');
  });

  it('should have proper styling classes', () => {
    const component = LoginPage.toString();

    // Check for Tailwind/custom classes present in the redesigned component
    expect(component).toContain('bg-[#f8f9ff]');
    expect(component).toContain('rounded-2xl');
    expect(component).toContain('shadow-sm');
    expect(component).toContain('bg-[#00236f]');
  });

  it('should have error state handling', () => {
    const component = LoginPage.toString();
    
    // Check for error state
    expect(component).toContain('setError');
    expect(component).toContain('error');
  });

  it('should have loading state handling', () => {
    const component = LoginPage.toString();

    // Loading tracked via mutation's isPending (no separate isLoading state)
    expect(component).toContain('isPending');
    expect(component).toContain('جاري تسجيل الدخول');
  });
});

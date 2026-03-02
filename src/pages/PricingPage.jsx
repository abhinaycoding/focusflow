import React, { useState } from 'react';
import Navigation from '../components/Navigation';
import { useAuth } from '../contexts/AuthContext'
import { usePlan } from '../contexts/PlanContext';
import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../contexts/LanguageContext';
import { createRazorpayOrder, openRazorpayCheckout, verifyRazorpayPayment } from '../lib/razorpay';
import './PricingPage.css';

const PricingPage = ({ onNavigate }) => {
  const { user, profile } = useAuth()
  const { isPro, refreshPlan, upgradePlan } = usePlan();
  const { t } = useTranslation();
  const toast = useToast();
  const [loading, setLoading] = useState(false);

  const handleUpgrade = async () => {
    if (!user) {
      onNavigate('auth');
      return;
    }

    if (isPro) return;

    setLoading(true);
    try {
      // 1. Open Razorpay checkout modal directly (Simple Flow)
      console.log('[Payment] Opening checkout...');
      const paymentResult = await openRazorpayCheckout({
        amount: 9900, // 99 INR in paise
        currency: 'INR',
        user,
        profile
      });
      console.log('[Payment] Checkout completed:', paymentResult);
      console.log('[Payment] Checkout completed:', paymentResult);

      // 3. Upgrade Plan directly in Firestore
      // In production, you'd verify the signature first.
      console.log('[Payment] Upgrading plan...');
      if (upgradePlan) {
        await upgradePlan();
        await refreshPlan();
      }

      toast(t('pricing.successMsg') || 'Welcome to the Master tier! All features unlocked. 🎉', 'success');
    } catch (err) {
      if (err.message === 'Payment cancelled') {
        toast(t('pricing.cancelledMsg') || 'Payment cancelled. No charges made.', 'info');
      } else {
        console.error('[Payment] Error:', err);
        toast(err.message || 'Payment failed. Please try again.', 'error');
      }
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="canvas-layout">
      <header className="canvas-header container">
        <div className="flex justify-between items-center border-b border-ink pb-4 pt-4">
          <div className="flex items-center gap-4">
            <div className="logo-mark font-serif cursor-pointer text-4xl text-primary" onClick={() => onNavigate('dashboard')}>NN.</div>
            <h1 className="text-xl font-serif text-muted italic ml-4 pl-4" style={{ borderLeft: '1px solid var(--border)' }}>Pricing</h1>
          </div>
          <button onClick={() => onNavigate('dashboard')} className="uppercase tracking-widest text-xs font-bold text-muted hover:text-primary transition-colors cursor-pointer">
            ← {t('nav.dashboard')}
          </button>
        </div>
      </header>

      <main className="pricing-container container">
        <div className="text-center mb-16">
          <h1 className="text-6xl font-serif text-primary mb-4">NoteNook Plans</h1>
          <p className="text-muted tracking-widest uppercase text-sm">
            Elevate your academic workflow.
          </p>
        </div>

        <div className="pricing-grid">
          {/* Neo-Brutalist Free Tier Card */}
          <div className="brutal-card group">
            <div className="brutal-header" style={{ backgroundColor: '#262626', padding: '3.5rem 2rem' }}>
              <h2 className="text-3xl font-black uppercase tracking-wider mb-0" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}>Scholar<br/>Tier</h2>
            </div>
            
            <div className="brutal-body" style={{ backgroundImage: 'linear-gradient(rgba(0,0,0,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(0,0,0,0.05) 1px, transparent 1px)' }}>
              <p className="font-medium mb-8 leading-relaxed text-lg z-10 relative" style={{ color: '#000' }}>
                The essential toolkit for disciplined study and digital minimalism.
              </p>
              
              <div className="brutal-features z-10 relative">
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#525252' }}>⏱</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>Focus Timer</span>
                </div>
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#737373' }}>🎯</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>5 Active Goals</span>
                </div>
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#a3a3a3' }}>✓</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>20 Ledger Tasks</span>
                </div>
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#d4d4d4', color: '#000' }}>📄</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>10 Archives</span>
                </div>
                <div className="brutal-feature-item" style={{ opacity: 0.4 }}>
                  <div className="brutal-icon" style={{ backgroundColor: '#e5e5e5', color: '#000' }}>❌</div>
                  <span className="font-bold text-sm line-through" style={{ color: '#000' }}>Drag Layout</span>
                </div>
                <div className="brutal-feature-item" style={{ opacity: 0.4 }}>
                  <div className="brutal-icon" style={{ backgroundColor: '#e5e5e5', color: '#000' }}>❌</div>
                  <span className="font-bold text-sm line-through" style={{ color: '#000' }}>Exam Planner</span>
                </div>
                <div className="brutal-feature-item" style={{ opacity: 0.4 }}>
                  <div className="brutal-icon" style={{ backgroundColor: '#e5e5e5', color: '#000' }}>❌</div>
                  <span className="font-bold text-sm line-through" style={{ color: '#000' }}>AI Builder</span>
                </div>
              </div>

              <div className="brutal-footer z-10 relative">
                <div className="brutal-price">
                  <span className="currency">₹</span>
                  <span className="amount">0</span>
                  <div className="period">forever</div>
                </div>

                <button 
                  className="brutal-btn"
                  disabled
                  style={{ backgroundColor: '#fff', color: '#000', opacity: 1 }}
                >
                  Current Plan
                </button>
              </div>
            </div>
          </div>

          {/* Neo-Brutalist Pro Tier Card */}
          <div className="brutal-card group">
            <div className="brutal-header" style={{ backgroundColor: 'var(--primary)', padding: '3.5rem 2rem' }}>
              <h2 className="text-3xl font-black uppercase tracking-wider mb-0" style={{ fontFamily: 'system-ui, -apple-system, sans-serif', color: '#fff' }}>Master<br/>Tier</h2>
              <div className="brutal-badge">
                PREMIUM
              </div>
            </div>
            
            <div className="brutal-body">
              <p className="font-medium mb-8 leading-relaxed text-lg z-10 relative" style={{ color: '#000' }}>
                Unrestricted access to advanced planning and complete canvas customization for top-tier students.
              </p>
              
              <div className="brutal-features z-10 relative">
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#4f46e5' }}>∞</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>Unlimited Goals</span>
                </div>
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#0ea5e9' }}>∞</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>Unlimited Tasks</span>
                </div>
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#8b5cf6' }}>📚</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>All Archives</span>
                </div>
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#f59e0b' }}>🔄</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>Drag Layout</span>
                </div>
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#ec4899' }}>📝</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>Exam Planner</span>
                </div>
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#10b981' }}>⭐</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>Pro AI Builder</span>
                </div>
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#14b8a6' }}>🎧</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>Priority Support</span>
                </div>
              </div>

              <div className="brutal-footer z-10 relative">
                <div className="brutal-price">
                  <span className="currency">₹</span>
                  <span className="amount">99</span>
                  <div className="period">one-time payment</div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'stretch' }}>
                  <button 
                    onClick={handleUpgrade}
                    disabled={isPro || loading}
                    className="brutal-btn"
                  >
                    {loading ? '⟳ Processing...' : isPro ? '✓ Active' : '⚡ Upgrade Now'}
                  </button>
                  <div style={{ 
                    fontSize: '0.6rem', 
                    textAlign: 'center', 
                    color: '#666', 
                    fontWeight: 600,
                    letterSpacing: '0.05em',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.3rem'
                  }}>
                    🔒 Secured by Razorpay
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default PricingPage;

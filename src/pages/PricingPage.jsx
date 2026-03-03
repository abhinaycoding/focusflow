import React, { useState } from 'react';
import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
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
  const [promoCode, setPromoCode] = useState('');
  const [appliedPromo, setAppliedPromo] = useState(null);
  const [promoError, setPromoError] = useState('');
  
  const BASE_PRICE = 99;

  const handleApplyPromo = async () => {
    if (!promoCode.trim()) return;
    setLoading(true);
    setPromoError('');
    try {
      // Check Firestore for codes - query by code only to avoid index Requirement for composite filters
      const q = query(
        collection(db, 'promo_codes'), 
        where('code', '==', promoCode.toUpperCase())
      );
      const snap = await getDocs(q);
      
      if (snap.empty) {
        setPromoError('Invalid or expired code');
      } else {
        const data = snap.docs[0].data();
        if (data.active) {
          setAppliedPromo({ code: data.code, discount: data.discount_pct });
          toast(`${data.discount_pct}% Discount Applied! ⚡`, 'success');
        } else {
          setPromoError('This code is inactive');
        }
      }
    } catch (err) {
      console.error('Promo Code Error Details:', err);
      if (err.code === 'permission-denied') {
        setPromoError('Database access denied. Please try again.');
      } else {
        setPromoError(`Validator error: ${err.message || 'unknown'}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const calculateTotal = () => {
    if (!appliedPromo) return BASE_PRICE;
    const discount = (BASE_PRICE * appliedPromo.discount) / 100;
    return Math.max(0, Math.floor(BASE_PRICE - discount));
  };

  const handleUpgrade = async () => {
    if (!user) {
      onNavigate('auth');
      return;
    }

    if (isPro) return;

    const finalAmount = calculateTotal();
    setLoading(true);

    try {
      let paymentId = 'PROMO_FREE';

      if (finalAmount > 0) {
        // 1. Open Razorpay checkout modal directly (Simple Flow)
        console.log('[Payment] Opening checkout for:', finalAmount);
        const paymentResult = await openRazorpayCheckout({
          amount: finalAmount * 100, // paise
          currency: 'INR',
          user,
          profile
        });
        paymentId = paymentResult.razorpay_payment_id;
      }

      // 2. Log Payment to Firestore (Audit Trail)
      console.log('[Payment] Logging transaction...');
      await addDoc(collection(db, 'payments'), {
        userId: user.uid,
        userName: profile?.full_name || user?.displayName || 'Scholar',
        userEmail: user.email,
        razorpay_payment_id: paymentId,
        amount: finalAmount,
        currency: 'INR',
        status: 'captured',
        promo_used: appliedPromo?.code || null,
        timestamp: serverTimestamp()
      });

      // 3. Upgrade Plan directly in Firestore
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
                {/* ✨ NEW FEATURES */}
                <div className="brutal-feature-item" style={{ borderTop: '2px solid #000', paddingTop: '0.5rem', marginTop: '0.25rem' }}>
                  <div className="brutal-icon" style={{ backgroundColor: '#6d28d9' }}>🎨</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>Nitro Profile Studio</span>
                  <span style={{ fontSize: '0.5rem', fontWeight: 900, background: '#6d28d9', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: 'auto' }}>NEW</span>
                </div>
                <div className="brutal-feature-item">
                  <div className="brutal-icon" style={{ backgroundColor: '#5865F2' }}>#</div>
                  <span className="font-bold text-sm" style={{ color: '#000' }}>Discord Room Channels</span>
                  <span style={{ fontSize: '0.5rem', fontWeight: 900, background: '#5865F2', color: '#fff', padding: '0.1rem 0.4rem', borderRadius: '4px', marginLeft: 'auto' }}>NEW</span>
                </div>
              </div>

              <div className="promo-container">
                <span className="promo-label">Have a special access code?</span>
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    placeholder="e.g. EARLYBIRD20" 
                    className="brutal-input flex-1 px-4 py-3 uppercase text-sm font-black"
                    value={promoCode}
                    onChange={(e) => setPromoCode(e.target.value)}
                    disabled={loading || appliedPromo}
                  />
                  <button 
                    className="brutal-btn py-2 px-6 text-sm"
                    style={{ 
                      backgroundColor: appliedPromo ? '#10b981' : '#000', 
                      color: '#fff',
                      padding: '0 1.5rem',
                      boxShadow: '4px 4px 0px 0px rgba(0,0,0,1)'
                    }}
                    onClick={handleApplyPromo}
                    disabled={loading || appliedPromo}
                  >
                    {loading ? '...' : appliedPromo ? 'VALID' : 'APPLY'}
                  </button>
                </div>
                {promoError && <p className="text-[10px] text-red-600 mt-2 font-black uppercase tracking-widest">{promoError}</p>}
              </div>

              <div className="brutal-footer z-10 relative mt-8 pt-6 border-t-4 border-black">
                <div className={`brutal-price ${appliedPromo ? 'price-animate' : ''}`}>
                  {appliedPromo && (
                    <div className="discount-badge">
                      CODE {appliedPromo.code} ACTIVE • {appliedPromo.discount}% OFF
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    {appliedPromo ? (
                      <>
                        <span className="text-3xl line-through opacity-30 font-black mr-2" style={{ color: '#000' }}>₹{BASE_PRICE}</span>
                        <span className="text-7xl font-black text-primary">₹{calculateTotal()}</span>
                      </>
                    ) : (
                      <span className="text-7xl font-black">₹{BASE_PRICE}</span>
                    )}
                  </div>
                  <div className="period mt-1">one-time payment</div>
                </div>

                <div className="mt-6">
                  <button 
                    onClick={handleUpgrade}
                    disabled={isPro || loading}
                    className="brutal-btn w-full"
                    style={{ backgroundColor: isPro ? '#10b981' : 'var(--primary)' }}
                  >
                    {loading ? '⟳' : isPro ? '✓ ACTIVE' : 'UPGRADE TO MASTER'}
                  </button>
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

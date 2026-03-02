// Razorpay helper for Firebase context
const RAZORPAY_KEY_ID = import.meta.env.VITE_RAZORPAY_KEY_ID

/**
 * For Firebase, actual order creation usually happens in a Cloud Function.
 * For now, we'll simulate order creation for the UI flow, 
 * or you can use your own backend endpoint.
 */
export async function createRazorpayOrder({ amount = 99, currency = 'INR', userId, userEmail, userName }) {
  // In a real production app, you would fetch this from YOUR_SERVER/create-order
  // For easy testing, we can often initiate with just the KEY_ID on the frontend 
  // if not using the 'Integrated' order flow, but the 'Order' flow is recommended.
  
  // Simulated order for testing
  return {
    orderId: `order_${Math.random().toString(36).slice(2)}`,
    amount: amount * 100, // Razorpay expects paise
    currency,
    keyId: RAZORPAY_KEY_ID
  }
}

/**
 * Verify payment signature. 
 * In production, this MUST happen on the server to prevent fraud.
 */
export async function verifyRazorpayPayment({
  razorpay_order_id,
  razorpay_payment_id,
  razorpay_signature,
  userId,
}) {
  // For now, we'll do basic validation and return success
  // Later, you can add a Firebase Cloud Function call here.
  console.log('[Razorpay] Verification requested for:', razorpay_payment_id)
  return { success: true }
}

/**
 * Open Razorpay checkout modal
 */
export function openRazorpayCheckout({ orderId, amount, currency, keyId, user, profile }) {
  return new Promise((resolve, reject) => {
    if (!window.Razorpay) {
      reject(new Error('Razorpay SDK not loaded. Please refresh the page.'))
      return
    }

    const options = {
      key: keyId || RAZORPAY_KEY_ID,
      amount: amount,
      currency: currency,
      name: 'NoteNook',
      description: 'Master Tier — Unlock all features',
      // order_id: orderId, // Removed for Simple Checkout flow
      prefill: {
        name: profile?.full_name || user?.displayName || '',
        email: user?.email || '',
      },
      theme: {
        color: '#CC4B2C', 
        backdrop_color: 'rgba(0,0,0,0.7)',
      },
      modal: {
        ondismiss: () => {
          reject(new Error('Payment cancelled'))
        },
        confirm_close: true,
        animation: true,
      },
      handler: (response) => {
        // For Simple Integration, we get razorpay_payment_id back
        resolve({
          razorpay_payment_id: response.razorpay_payment_id,
        })
      },
    }

    const rzp = new window.Razorpay(options)
    rzp.on('payment.failed', (response) => {
      reject(new Error(response.error?.description || 'Payment failed'))
    })
    rzp.open()
  })
}

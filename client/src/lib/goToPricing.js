/** Navigate home and scroll to the pricing section (paywall / upgrade flow). */
export function goToPricing(navigate, { replace = false } = {}) {
  navigate('/?pricing=1#pricing', { replace });
  requestAnimationFrame(() => {
    document.getElementById('pricing')?.scrollIntoView({ behavior: 'smooth' });
  });
}

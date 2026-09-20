export async function compareFaces(applicationId) {
  if (!applicationId) {
    return { matched: false, distance: null, reason: 'missing_application_id' };
  }

  try {
    const response = await fetch('/api/face-match', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        applicationId
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.error || 'Failed to compare faces');
    }

    const result = await response.json();
    return { 
      matched: result.matched, 
      distance: result.distance,
      reason: result.reason || null
    };
  } catch (err) {
    console.error("Error during face comparison:", err);
    return { matched: false, distance: null, reason: 'comparison_error' };
  }
}

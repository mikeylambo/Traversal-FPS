using UnityEngine;

namespace SLU.Traversal
{
    /// <summary>
    /// Shared landing rules for Traversal warp arrivals. Mirrors the web build's forgiving
    /// endpoint behavior while letting Unity physics own the actual world geometry.
    /// </summary>
    public static class TraversalLandingResolver
    {
        public const float EdgeCushion = 0.26f;
        public const float VerticalCushion = 0.72f;
        public const float PhaseHangDuration = 0.12f;

        public static bool TrySettle(CharacterController body, float eyeHeight)
        {
            if (!body) return false;

            Vector3 eye = body.transform.position + Vector3.up * eyeHeight;
            Vector3 castOrigin = eye + Vector3.up * VerticalCushion;
            float castDistance = eyeHeight + VerticalCushion * 2f;

            if (!Physics.SphereCast(
                    castOrigin,
                    Mathf.Max(0.05f, TraversalPlayer.PlayerRadius - 0.06f),
                    Vector3.down,
                    out RaycastHit hit,
                    castDistance,
                    ~0,
                    QueryTriggerInteraction.Ignore))
                return false;

            if (hit.normal.y < 0.55f) return false;

            float standingEyeY = hit.point.y + eyeHeight;
            if (Mathf.Abs(eye.y - standingEyeY) > VerticalCushion) return false;

            bool wasEnabled = body.enabled;
            body.enabled = false;
            Vector3 p = body.transform.position;
            p.y = hit.point.y + 0.02f;
            body.transform.position = p;
            body.enabled = wasEnabled;
            return true;
        }
    }
}

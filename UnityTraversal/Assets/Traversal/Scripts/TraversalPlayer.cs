using UnityEngine;
using UnityEngine.InputSystem;

namespace SLU.Traversal
{
    [RequireComponent(typeof(CharacterController))]
    public sealed class TraversalPlayer : MonoBehaviour
    {
        public const float StandEyeHeight = 1.7f;
        public const float CrouchEyeHeight = 1.06f;
        public const float PlayerRadius = 0.32f;
        public const float RunSpeed = 7.5f;
        public const float CrouchSpeed = 4.9f;
        public const float Gravity = 18f;

        public Camera view;
        public WarpSystem warp;
        CharacterController _body;
        float _pitch;
        float _verticalVelocity;
        bool _wasSelecting;

        public void Initialize(Camera camera, WarpSystem warpSystem)
        {
            view = camera;
            warp = warpSystem;
            _body = GetComponent<CharacterController>();
            _body.radius = PlayerRadius;
            _body.height = 1.86f;
            _body.center = new Vector3(0f, 0.93f, 0f);
            _body.stepOffset = 0.38f;
            Cursor.lockState = CursorLockMode.Locked;
            Cursor.visible = false;
        }

        void Update()
        {
            if (!_body || !view || !warp) return;
            if (Keyboard.current?.escapeKey.wasPressedThisFrame == true)
            {
                Cursor.lockState = CursorLockMode.None;
                Cursor.visible = true;
            }
            if (Mouse.current?.leftButton.wasPressedThisFrame == true) Fire();

            bool selecting = Mouse.current?.rightButton.isPressed == true;
            float scroll = Mouse.current?.scroll.ReadValue().y ?? 0f;
            if (Mathf.Abs(scroll) > 0.01f) warp.AdjustSelection(Mathf.Sign(scroll));
            warp.UpdateSelectionVisual(selecting);
            if (_wasSelecting && !selecting && warp.HasAnchor) warp.Commit(transform.position + Vector3.up * EyeHeight());
            _wasSelecting = selecting;

            Vector3 eyePos = transform.position + Vector3.up * EyeHeight();
            if (warp.IsTransiting)
            {
                _body.enabled = false;
                if (warp.TickTransit(Time.deltaTime, ref eyePos)) transform.position = eyePos - Vector3.up * EyeHeight();
                _body.enabled = true;
                return;
            }

            Look();
            Move();
        }

        void Look()
        {
            Vector2 look = Vector2.zero;
            if (Mouse.current != null) look += Mouse.current.delta.ReadValue() * 0.09f;
            if (Gamepad.current != null) look += Gamepad.current.rightStick.ReadValue() * (140f * Time.deltaTime);
            transform.Rotate(0f, look.x, 0f);
            _pitch = Mathf.Clamp(_pitch - look.y, -88f, 88f);
            view.transform.localRotation = Quaternion.Euler(_pitch, 0f, 0f);
        }

        void Move()
        {
            Vector2 input = Vector2.zero;
            if (Keyboard.current != null)
            {
                if (Keyboard.current.aKey.isPressed) input.x -= 1f;
                if (Keyboard.current.dKey.isPressed) input.x += 1f;
                if (Keyboard.current.sKey.isPressed) input.y -= 1f;
                if (Keyboard.current.wKey.isPressed) input.y += 1f;
            }
            if (Gamepad.current != null && Gamepad.current.leftStick.ReadValue().sqrMagnitude > input.sqrMagnitude)
                input = Gamepad.current.leftStick.ReadValue();
            input = Vector2.ClampMagnitude(input, 1f);

            bool crouch = Keyboard.current?.leftCtrlKey.isPressed == true || Keyboard.current?.cKey.isPressed == true || Gamepad.current?.buttonEast.isPressed == true;
            float targetHeight = crouch ? CrouchEyeHeight : StandEyeHeight;
            Vector3 camLocal = view.transform.localPosition;
            camLocal.y = Mathf.Lerp(camLocal.y, targetHeight, 1f - Mathf.Exp(-17f * Time.deltaTime));
            view.transform.localPosition = camLocal;

            Vector3 planar = (transform.right * input.x + transform.forward * input.y) * (crouch ? CrouchSpeed : RunSpeed);
            if (_body.isGrounded && _verticalVelocity < 0f) _verticalVelocity = -1f;
            _verticalVelocity -= Gravity * Time.deltaTime;
            planar.y = _verticalVelocity;
            _body.Move(planar * Time.deltaTime);

            if (transform.position.y < -9.5f)
                FindFirstObjectByType<TraversalSession>()?.ReloadRoom();
        }

        float EyeHeight() => view ? view.transform.localPosition.y : StandEyeHeight;

        void Fire()
        {
            Ray ray = new(view.transform.position, view.transform.forward);
            if (!Physics.Raycast(ray, out RaycastHit hit, 250f, ~0, QueryTriggerInteraction.Ignore)) return;
            var target = hit.collider.GetComponentInParent<WarpTarget>();
            if (!target) return;
            Vector3 endpoint = target.transform.position;
            Vector3 origin = view.transform.position;
            if (target.TryKill(origin, ray.direction)) warp.Write(origin, endpoint);
        }
    }
}

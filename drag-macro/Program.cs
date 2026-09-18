using System.Runtime.InteropServices;

namespace PersonalDragMacro;

internal static class Program
{
    [STAThread]
    private static void Main()
    {
        ApplicationConfiguration.Initialize();
        Application.Run(new MacroForm());
    }
}

[Flags]
internal enum HotkeyModifiers : uint
{
    Alt = 0x0001,
    Control = 0x0002,
    Shift = 0x0004,
    Win = 0x0008,
    NoRepeat = 0x4000
}

internal enum DragButton
{
    Left,
    Right
}

internal sealed class MacroForm : Form
{
    private const int WmHotkey = 0x0312;
    private const int DragHotkeyId = 1;
    private const int EmergencyHotkeyId = 2;
    private const uint MouseLeftDown = 0x0002;
    private const uint MouseLeftUp = 0x0004;
    private const uint MouseRightDown = 0x0008;
    private const uint MouseRightUp = 0x0010;

    private readonly TextBox _hotkeyBox = new();
    private readonly Button _recordButton = new();
    private readonly Button _applyButton = new();
    private readonly Button _releaseButton = new();
    private readonly ComboBox _buttonPicker = new();
    private readonly Label _status = new();
    private readonly Label _emergencyStatus = new();
    private bool _recording;
    private bool _dragging;
    private bool _dragHotkeyRegistered;
    private bool _emergencyHotkeyRegistered;
    private Keys _hotkey = Keys.F6;
    private HotkeyModifiers _hotkeyModifiers = HotkeyModifiers.Control | HotkeyModifiers.Shift;

    public MacroForm()
    {
        Text = "Personal Drag Macro";
        Size = new Size(580, 440);
        MinimumSize = new Size(580, 440);
        MaximumSize = new Size(580, 440);
        StartPosition = FormStartPosition.CenterScreen;
        BackColor = Color.FromArgb(15, 23, 42);
        ForeColor = Color.FromArgb(226, 232, 240);
        Font = new Font("Segoe UI", 10F);

        var title = new Label
        {
            Text = "Personal Drag Macro",
            Font = new Font("Segoe UI", 22F, FontStyle.Bold),
            ForeColor = Color.White,
            Location = new Point(32, 26),
            AutoSize = true
        };
        var subtitle = new Label
        {
            Text = "A local Windows utility that toggles a mouse-button hold.",
            ForeColor = Color.FromArgb(180, 195, 218),
            Location = new Point(34, 70),
            AutoSize = true
        };

        var hotkeyLabel = FieldLabel("Toggle hotkey", 32, 118);
        _hotkeyBox.Location = new Point(32, 145);
        _hotkeyBox.Size = new Size(330, 38);
        _hotkeyBox.ReadOnly = true;
        _hotkeyBox.TabStop = false;
        _hotkeyBox.BackColor = Color.FromArgb(30, 41, 59);
        _hotkeyBox.ForeColor = Color.White;
        _hotkeyBox.BorderStyle = BorderStyle.FixedSingle;
        _hotkeyBox.Text = HotkeyText();

        _recordButton.Text = "Record hotkey";
        _recordButton.Location = new Point(374, 145);
        _recordButton.Size = new Size(155, 38);
        _recordButton.Click += (_, _) => BeginRecording();

        var mouseButtonLabel = FieldLabel("Mouse button to hold", 32, 204);
        _buttonPicker.Location = new Point(32, 231);
        _buttonPicker.Size = new Size(220, 38);
        _buttonPicker.DropDownStyle = ComboBoxStyle.DropDownList;
        _buttonPicker.Items.AddRange(["Left mouse button", "Right mouse button"]);
        _buttonPicker.SelectedIndex = 0;

        _applyButton.Text = "Save hotkey";
        _applyButton.Location = new Point(32, 292);
        _applyButton.Size = new Size(175, 42);
        _applyButton.Click += (_, _) => ApplyHotkey();

        _releaseButton.Text = "Release now";
        _releaseButton.Location = new Point(219, 292);
        _releaseButton.Size = new Size(143, 42);
        _releaseButton.BackColor = Color.FromArgb(112, 38, 57);
        _releaseButton.Click += (_, _) => ReleaseDrag("Released from the app.");

        _status.Location = new Point(32, 350);
        _status.MaximumSize = new Size(500, 0);
        _status.ForeColor = Color.FromArgb(134, 239, 172);
        _status.AutoSize = true;

        _emergencyStatus.Location = new Point(32, 378);
        _emergencyStatus.MaximumSize = new Size(500, 0);
        _emergencyStatus.ForeColor = Color.FromArgb(180, 195, 218);
        _emergencyStatus.AutoSize = true;

        Controls.AddRange([title, subtitle, hotkeyLabel, _hotkeyBox, _recordButton, mouseButtonLabel,
            _buttonPicker, _applyButton, _releaseButton, _status, _emergencyStatus]);

        Shown += (_, _) => RegisterInitialHotkeys();
        FormClosing += (_, _) =>
        {
            ReleaseDrag("Closing.");
            UnregisterHotKey(Handle, DragHotkeyId);
            UnregisterHotKey(Handle, EmergencyHotkeyId);
        };
        KeyPreview = true;
        KeyDown += CaptureHotkey;
    }

    private static Label FieldLabel(string text, int x, int y) => new()
    {
        Text = text,
        Location = new Point(x, y),
        ForeColor = Color.FromArgb(226, 232, 240),
        Font = new Font("Segoe UI", 9F, FontStyle.Bold),
        AutoSize = true
    };

    private void RegisterInitialHotkeys()
    {
        _emergencyHotkeyRegistered = RegisterHotKey(Handle, EmergencyHotkeyId, (uint)HotkeyModifiers.NoRepeat, (uint)Keys.F8);
        _emergencyStatus.Text = _emergencyHotkeyRegistered
            ? "F8 is available as an emergency release key."
            : "F8 is in use by another app. Press your toggle hotkey again, or use Release now.";

        if (RegisterDragHotkey(_hotkeyModifiers, _hotkey))
            SetStatus($"Ready — press {HotkeyText()} to start a drag.", false);
        else
            SetStatus($"{HotkeyText()} is unavailable. Record a different hotkey, then save it.", true);
    }

    private void BeginRecording()
    {
        _recording = true;
        _recordButton.Text = "Press a key…";
        _recordButton.BackColor = Color.FromArgb(194, 101, 33);
        SetStatus("Press a key combination now. F8 stays reserved for emergency release.", false);
        Focus();
    }

    private void CaptureHotkey(object? sender, KeyEventArgs e)
    {
        if (!_recording) return;
        if (e.KeyCode is Keys.ControlKey or Keys.ShiftKey or Keys.Menu or Keys.LWin or Keys.RWin) return;

        e.SuppressKeyPress = true;
        if (e.KeyCode == Keys.F8)
        {
            SetStatus("F8 is reserved for emergency release. Choose a different hotkey.", true);
            return;
        }

        _hotkey = e.KeyCode;
        _hotkeyModifiers = GetModifiers(e);
        _hotkeyBox.Text = HotkeyText();
        _recording = false;
        _recordButton.Text = "Record hotkey";
        _recordButton.BackColor = SystemColors.Control;
        SetStatus($"Selected {HotkeyText()}. Click Save hotkey to activate it.", false);
    }

    private static HotkeyModifiers GetModifiers(KeyEventArgs e)
    {
        var modifiers = 0u;
        if (e.Control) modifiers |= (uint)HotkeyModifiers.Control;
        if (e.Shift) modifiers |= (uint)HotkeyModifiers.Shift;
        if (e.Alt) modifiers |= (uint)HotkeyModifiers.Alt;
        return (HotkeyModifiers)modifiers;
    }

    private string HotkeyText()
    {
        var pieces = new List<string>();
        if (_hotkeyModifiers.HasFlag(HotkeyModifiers.Control)) pieces.Add("Ctrl");
        if (_hotkeyModifiers.HasFlag(HotkeyModifiers.Shift)) pieces.Add("Shift");
        if (_hotkeyModifiers.HasFlag(HotkeyModifiers.Alt)) pieces.Add("Alt");
        pieces.Add(_hotkey.ToString());
        return string.Join(" + ", pieces);
    }

    private void ApplyHotkey()
    {
        ReleaseDrag("Settings changed — drag released.");
        if (RegisterDragHotkey(_hotkeyModifiers, _hotkey))
            SetStatus($"Saved — {HotkeyText()} works globally while this app is open.", false);
        else
            SetStatus($"{HotkeyText()} is unavailable. Choose a different key combination.", true);
    }

    private bool RegisterDragHotkey(HotkeyModifiers modifiers, Keys key)
    {
        if (_dragHotkeyRegistered)
        {
            UnregisterHotKey(Handle, DragHotkeyId);
            _dragHotkeyRegistered = false;
        }

        _dragHotkeyRegistered = RegisterHotKey(Handle, DragHotkeyId,
            (uint)(modifiers | HotkeyModifiers.NoRepeat), (uint)key);
        return _dragHotkeyRegistered;
    }

    protected override void WndProc(ref Message m)
    {
        if (m.Msg == WmHotkey)
        {
            var id = m.WParam.ToInt32();
            if (id == DragHotkeyId) ToggleDrag();
            if (id == EmergencyHotkeyId) ReleaseDrag("Emergency release (F8).");
        }
        base.WndProc(ref m);
    }

    private DragButton SelectedButton => _buttonPicker.SelectedIndex == 1 ? DragButton.Right : DragButton.Left;

    private void ToggleDrag()
    {
        if (_dragging)
        {
            ReleaseDrag("Drag released.");
            return;
        }

        mouse_event(SelectedButton == DragButton.Left ? MouseLeftDown : MouseRightDown, 0, 0, 0, UIntPtr.Zero);
        _dragging = true;
        SetStatus("Dragging — move the mouse normally. Press the hotkey again to release.", false);
    }

    private void ReleaseDrag(string message)
    {
        if (_dragging)
            mouse_event(SelectedButton == DragButton.Left ? MouseLeftUp : MouseRightUp, 0, 0, 0, UIntPtr.Zero);
        _dragging = false;
        SetStatus(message, false);
    }

    private void SetStatus(string text, bool warning)
    {
        _status.Text = text;
        _status.ForeColor = warning ? Color.FromArgb(253, 186, 116) : Color.FromArgb(134, 239, 172);
    }

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool RegisterHotKey(IntPtr hWnd, int id, uint fsModifiers, uint vk);

    [DllImport("user32.dll", SetLastError = true)]
    private static extern bool UnregisterHotKey(IntPtr hWnd, int id);

    [DllImport("user32.dll")]
    private static extern void mouse_event(uint dwFlags, uint dx, uint dy, uint dwData, UIntPtr dwExtraInfo);
}

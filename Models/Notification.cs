namespace SignalRNotifications.Models;

public class Notification
{
    public string Id { get; set; } = Guid.NewGuid().ToString("N")[..8];
    public string From { get; set; } = string.Empty;
    public string Message { get; set; } = string.Empty;
    public NotificationType Type { get; set; }
    public DateTime Timestamp { get; set; } = DateTime.UtcNow;
}

public enum NotificationType
{
    Broadcast,
    Direct
}

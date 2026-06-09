using Microsoft.AspNetCore.SignalR;
using SignalRNotifications.Models;
using System.Collections.Concurrent;

namespace SignalRNotifications.Hubs;

public class NotificationHub : Hub
{
    // Static: compartido entre todas las instancias del Hub (una por llamada)
    private static readonly ConcurrentDictionary<string, string> _connectedUsers = new();

    public override async Task OnDisconnectedAsync(Exception? exception)
    {
        if (_connectedUsers.TryRemove(Context.ConnectionId, out var username))
        {
            await Clients.Others.SendAsync("UserDisconnected", username);
            await Clients.All.SendAsync("UpdateUserCount", _connectedUsers.Count);
            await Clients.All.SendAsync("UpdateUserList",
                _connectedUsers.Values.Distinct().ToList());
        }

        await base.OnDisconnectedAsync(exception);
    }

    public async Task Register(string username)
    {
        _connectedUsers[Context.ConnectionId] = username;

        // Grupo personal: permite enviar mensajes directos aunque el usuario
        // tenga varias pestañas abiertas (varias conexiones con el mismo nombre)
        await Groups.AddToGroupAsync(Context.ConnectionId, username);

        await Clients.Others.SendAsync("UserConnected", username);
        await Clients.All.SendAsync("UpdateUserCount", _connectedUsers.Count);
        await Clients.All.SendAsync("UpdateUserList",
            _connectedUsers.Values.Distinct().ToList());

        await Clients.Caller.SendAsync("Registered", username);
    }

    public async Task SendBroadcast(string message)
    {
        if (!_connectedUsers.TryGetValue(Context.ConnectionId, out var username))
            return;

        var notification = new Notification
        {
            From    = username,
            Message = message,
            Type    = NotificationType.Broadcast
        };

        await Clients.All.SendAsync("ReceiveNotification", notification);
    }

    public async Task SendDirect(string targetUsername, string message)
    {
        if (!_connectedUsers.TryGetValue(Context.ConnectionId, out var username))
            return;

        var notification = new Notification
        {
            From    = username,
            Message = message,
            Type    = NotificationType.Direct
        };

        await Clients.Group(targetUsername).SendAsync("ReceiveNotification", notification);

        // Enviar copia al remitente si no se está enviando a sí mismo
        if (!username.Equals(targetUsername, StringComparison.OrdinalIgnoreCase))
            await Clients.Caller.SendAsync("ReceiveNotification", notification);
    }
}

using System.Text.Json;
using System.Text.Json.Serialization;
using SignalRNotifications.Hubs;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR()
    .AddJsonProtocol(options =>
    {
        // Propiedades en camelCase: "from", "message", "type", "timestamp"
        options.PayloadSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
        // Enum serializado como string: "broadcast" / "direct" (no 0 / 1)
        options.PayloadSerializerOptions.Converters
            .Add(new JsonStringEnumConverter(JsonNamingPolicy.CamelCase));
    });

var app = builder.Build();

app.UseDefaultFiles();  // "/" → "index.html"
app.UseStaticFiles();   // sirve wwwroot/

app.MapHub<NotificationHub>("/hubs/notifications");

app.Run();

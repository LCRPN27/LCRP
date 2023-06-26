RegisterCommand(main.commandName, function(source, args, rawCommand)
    if (source > 0) then
        TriggerClientEvent("Client:toggleThrowBag", source)
    end
end, main.enableAcePermissions)

RegisterServerEvent('Server:spawnThrowBag')
AddEventHandler('Server:spawnThrowBag', function(coords, net, net2)
    TriggerClientEvent("Client:spawnThrowBag", -1, coords, net, net2)
end)
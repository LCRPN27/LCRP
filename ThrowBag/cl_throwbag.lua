TriggerEvent('chat:addSuggestion', '/'..main.commandName, translations.commandSuggestion)

AddTextEntry("WT_THROWLINE", "Throwline")

RegisterNetEvent('Client:toggleThrowBag')
AddEventHandler('Client:toggleThrowBag', function(setup)
    local ped = PlayerPedId()
    if IsPedInAnyVehicle(ped, true) then
        showNotification(translations.outsideVehicle)
        return
    end
    startThrowBagAiming()
end)

function startThrowBagAiming()
    local throwBagAiming = true
    local ped = PlayerPedId()
    GiveWeaponToPed(ped, main.weapon, 1.0, false, true)
    local targetFound = false
    local target = 0
    while throwBagAiming do
        ped = PlayerPedId()
        local player = PlayerId()
        local found, entity = GetEntityPlayerIsFreeAimingAt(player)
        if IsPedShooting(ped) then
            if found then
                targetFound = true
                target = entity
                throwbagAiming = false
            else
                targetFound = false
            end
            break
        end
        Wait(0)
    end
    if targetFound then
        showNotification(translations.playerFound)
        spawnRope(target)
    else
        showNotification(translations.noPlayerFound)
    end
    throwBagAiming = false
end

RegisterNetEvent('Client:spawnThrowBag')
AddEventHandler('Client:spawnThrowBag', function(coords, net, net2)
    local ped = PlayerPedId()
    local coords2 = GetEntityCoords(ped)
    local distance = #(coords2 - coords)
    if distance < 30.0 then
        RopeLoadTextures()
        local length = GetRopeLength(rope) + 1.0
        local entity1 = NetToPed(net)
        local entity2 = NetToPed(net2)
        local coords3 = GetEntityCoords(entity1)
        local dist2 = #(GetEntityCoords(entity1) - GetEntityCoords(entity2))
        local rope = AddRope(coords.x, coords.y, coords.z, 0.0, 0.0, 0.0, dist2, 2, dist2 + 10.0, 1.0, 0, 0, 0, 0, 0, 0, 0)
        AttachEntitiesToRope(rope, entity2, entity1, coords.x, coords.y, coords.z + 0.2, coords3.x, coords3.y, coords3.z - 0.60, dist2, true, true)
        StartRopeWinding(rope)
        FreezeEntityPosition(entity2, true)
        RequestAnimDict(main.animDict2)
        while not HasAnimDictLoaded(main.animDict2) do Wait(0) end
        TaskPlayAnim(entity2, main.animDict2, main.animName2, 8.0, -8.0, -1, 1, 0.0, 0, 0, 0)
        local notSwimming = false
        while not (#(GetEntityCoords(entity1) - GetEntityCoords(entity2)) < 1.4) do
            if not notSwimming then
                if main.enableAnimation then
                    if not IsPedSwimming(entity1) then
                        notSwimming = true
                        RequestAnimDict(main.animDict)
                        while not HasAnimDictLoaded(main.animDict) do Wait(0) end
                        TaskPlayAnim(entity1, main.animDict, main.animName, 8.0, -8.0, -1, 1, 0.0, 0, 0, 0)
                    end
                end
            end
            local ropeLength =GetRopeLength(rope)
            if ropeLength < 1.4 then
                break
            end
            RopeForceLength(rope, ropeLength - 0.1)
            if main.pullInSpeed < 0 then
                Wait(0)
            else
                Wait(main.pullInSpeed)
            end
        end
        DeleteRope(rope)
        ClearPedTasks(entity1)
        ClearPedTasks(entity2)
        FreezeEntityPosition(entity2, false)
        RopeUnloadTextures()
    end
end)


function spawnRope(entity)
    local ped = PlayerPedId()
    local coords = GetEntityCoords(ped)
    TriggerServerEvent("Server:spawnThrowBag", coords, PedToNet(entity), PedToNet(ped))
    Wait(2000)
    showNotification(translations.ropeWinding)
end

function showNotification(message)
    message = message.."."
    SetNotificationTextEntry("STRING")
    AddTextComponentString(message)
    DrawNotification(0,1)
end
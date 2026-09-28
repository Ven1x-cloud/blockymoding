package com.modder.mijn_eerste_mod.story;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import net.minecraft.core.BlockPos;
import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.AbstractContainerMenu;
import net.minecraft.world.inventory.SimpleMenuProvider;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
import net.minecraft.world.phys.BlockHitResult;
import com.modder.mijn_eerste_mod.ModMain;


import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.UUID;

/**
 * Leest data/mijn_eerste_mod/story/storyline.json en voert acties uit.
 *
 * ⚠️ TODO (vraag de AI of bouw zelf in ai-code/):
 *   - voortgang opslaan zodat hij een herstart overleeft
 *   - meer trigger-types / voorwaarden
 */
public final class StoryManager {
    public static final StoryManager INSTANCE = new StoryManager();

    public static class Event {
        public String id;
        public JsonObject trigger;
        public List<JsonObject> actions = new ArrayList<>();
    }

    public static class Chapter {
        public String id;
        public String title;
        public List<Event> events = new ArrayList<>();
    }

    public static class Progress {
        public int chapterIndex = 0;
        public final Set<String> done = new HashSet<>();
    }

    private final Map<UUID, Progress> progress = new HashMap<>();
    private List<Chapter> chapters = List.of();
    private boolean loaded = false;

    private StoryManager() {}

    /** (Her)laad de verhaallijn van de server. */
    public synchronized void load(MinecraftServer server) {
        try {
            ResourceLocation id = ModMain.id("story/storyline.json");
            var resource = server.getResourceManager().getResource(id);
            try (InputStream in = resource.get().open()) {
                JsonObject root = new Gson().fromJson(
                        new InputStreamReader(in, StandardCharsets.UTF_8), JsonObject.class);
                chapters = parse(root);
                loaded = true;
                ModMain.LOGGER.info("[Story] {} hoofdstukken geladen.", chapters.size());
            }
        } catch (Exception e) {
            ModMain.LOGGER.warn("[Story] storyline.json kon niet geladen worden: {}", e.getMessage());
            chapters = List.of();
            loaded = true;
        }
    }

    private List<Chapter> parse(JsonObject root) {
        List<Chapter> out = new ArrayList<>();
        JsonArray arr = root.has("chapters") ? root.getAsJsonArray("chapters") : new JsonArray();
        for (JsonElement el : arr) {
            JsonObject c = el.getAsJsonObject();
            Chapter ch = new Chapter();
            ch.id = getStr(c, "id", "hoofdstuk");
            ch.title = getStr(c, "title", ch.id);
            if (c.has("events")) {
                for (JsonElement ee : c.getAsJsonArray("events")) {
                    JsonObject eo = ee.getAsJsonObject();
                    Event ev = new Event();
                    ev.id = getStr(eo, "id", ch.id + "_" + Math.abs(eo.hashCode()));
                    ev.trigger = eo.has("trigger") ? eo.getAsJsonObject("trigger") : new JsonObject();
                    if (eo.has("actions"))
                        for (JsonElement ae : eo.getAsJsonArray("actions"))
                            ev.actions.add(ae.getAsJsonObject());
                    ch.events.add(ev);
                }
            }
            out.add(ch);
        }
        return out;
    }

    private static String getStr(JsonObject o, String k, String def) {
        return o.has(k) && !o.get(k).isJsonNull() ? o.get(k).getAsString() : def;
    }

    public Progress getProgress(UUID uuid) {
        return progress.computeIfAbsent(uuid, u -> new Progress());
    }

    // ── Triggers ──

    public void onJoin(ServerPlayer player) {
        ensureLoaded(player);
        Progress pr = getProgress(player.getUuid());
        if (pr.chapterIndex == 0 && pr.done.isEmpty()) {
            runTrigger(player, "join");
        }
    }

    public void onKill(ServerPlayer killer, net.minecraft.world.entity.Entity killed) {
        ensureLoaded(killer);
        ResourceLocation typeId = BuiltInRegistries.ENTITY_TYPE.getKey(killed.getType());
        runTrigger(killer, "kill", "entity", String.valueOf(typeId));
    }

    public void onInteractBlock(ServerPlayer player, BlockHitResult hit) {
        ensureLoaded(player);
        ResourceLocation blockId = BuiltInRegistries.BLOCK.getKey(
                player.level().getBlockState(hit.getBlockPos()).getBlock());
        runTrigger(player, "block", "block", String.valueOf(blockId));
    }

    public void onInteractItem(ServerPlayer player, ItemStack stack) {
        ensureLoaded(player);
        ResourceLocation itemId = BuiltInRegistries.ITEM.getKey(stack.getItem());
        runTrigger(player, "item", "item", String.valueOf(itemId));
    }

    public void onWorldTick(ServerLevel level) {
        if (!loaded) load(level.getServer());
        if (level.getGameTime() % 20 != 0) return;
        for (ServerPlayer player : level.players()) {
            Progress pr = getProgress(player.getUuid());
            Chapter ch = currentChapter(pr);
            if (ch == null) continue;
            for (Event ev : ch.events) {
                if (matchLocation(player, ev.trigger)) {
                    runEvent(player, ev);
                }
            }
        }
    }

    private void ensureLoaded(ServerPlayer player) {
        if (!loaded) load(player.getServer());
    }

    private Chapter currentChapter(Progress pr) {
        if (pr.chapterIndex < 0 || pr.chapterIndex >= chapters.size()) return null;
        return chapters.get(pr.chapterIndex);
    }

    private boolean matchLocation(Player player, JsonObject trigger) {
        if (trigger == null || !"location".equals(getStr(trigger, "type", ""))) return false;
        double x = trigger.has("x") ? trigger.get("x").getAsDouble() : 0;
        double y = trigger.has("y") ? trigger.get("y").getAsDouble() : 0;
        double z = trigger.has("z") ? trigger.get("z").getAsDouble() : 0;
        double r = trigger.has("r") ? trigger.get("r").getAsDouble() : 4;
        double dx = player.getX() - x, dy = player.getY() - y, dz = player.getZ() - z;
        return dx * dx + dy * dy + dz * dz <= r * r;
    }

    /** Zoek passende events in het huidige hoofdstuk en voer ze uit. */
    public void runTrigger(ServerPlayer player, String type, String field, String value) {
        Progress pr = getProgress(player.getUuid());
        Chapter ch = currentChapter(pr);
        if (ch == null) return;
        for (Event ev : ch.events) {
            if (pr.done.contains(ev.id)) continue;
            String t = getStr(ev.trigger, "type", "");
            if (!type.equals(t)) continue;
            if (field != null && !value.equals(getStr(ev.trigger, field, ""))) continue;
            runEvent(player, ev);
        }
    }

    public void runTrigger(ServerPlayer player, String type) {
        runTrigger(player, type, null, null);
    }

    /** Voer alle acties van een event uit. */
    public void runEvent(ServerPlayer player, Event ev) {
        Progress pr = getProgress(player.getUuid());
        if (pr.done.contains(ev.id)) return;
        pr.done.add(ev.id);
        for (JsonObject action : ev.actions) {
            execute(player, action);
        }
    }

    private void execute(ServerPlayer player, JsonObject a) {
        String type = getStr(a, "type", "");
        Level level = player.level();
        switch (type) {
            case "message" -> player.sendSystemMessage(Component.literal(getStr(a, "text", "")));
            case "give" -> {
                String itemId = getStr(a, "item", "minecraft:stone");
                int count = a.has("count") ? a.get("count").getAsInt() : 1;
                var item = BuiltInRegistries.ITEM.getOptional(ResourceLocation.tryParse(itemId)).orElse(null);
                if (item != null && item != Items.AIR) {
                    player.getInventory().add(new ItemStack(item, count));
                    player.displayClientMessage(Component.literal("+ " + count + " × " + itemId), true);
                }
            }
            case "weather" -> {
                String w = getStr(a, "state", "clear");
                runCommand(player, w.equals("thunder") ? "weather thunder"
                        : w.equals("rain") ? "weather rain" : "weather clear");
            }
            case "time" -> runCommand(player, "time set " + ("night".equals(getStr(a, "state", "day")) ? "night" : "day"));
            case "spawn" -> {
                String entityId = getStr(a, "entity", "minecraft:pig");
                int count = a.has("count") ? a.get("count").getAsInt() : 1;
                var typeRef = BuiltInRegistries.ENTITY_TYPE.getOptional(ResourceLocation.tryParse(entityId)).orElse(null);
                var rng = java.util.concurrent.ThreadLocalRandom.current();
                for (int i = 0; i < count && typeRef != null; i++) {
                    var entity = typeRef.create(level);
                    if (entity != null) {
                        entity.moveTo(
                                player.getX() + (rng.nextDouble() - 0.5) * 3,
                                player.getY(),
                                player.getZ() + (rng.nextDouble() - 0.5) * 3,
                                rng.nextFloat() * 360f, 0f);
                        level.addFreshEntity(entity);
                    }
                }
            }
            case "command" -> runCommand(player, getStr(a, "cmd", "say hallo"));
            case "gui" -> openGui(player, getStr(a, "gui", ""));
            case "next" -> {
                Progress pr = getProgress(player.getUuid());
                pr.chapterIndex++;
                Chapter ch = currentChapter(pr);
                player.sendSystemMessage(Component.literal("§6" + (ch != null ? ch.title : "Einde van het verhaal!")));
            }
            default -> ModMain.LOGGER.warn("[Story] onbekende actie: {}", type);
        }
    }

    /** Voer een commando uit (op de server). */
    private void runCommand(ServerPlayer player, String cmd) {
        if (player.getServer() != null) {
            player.getServer().getCommands()
                    .performPrefixedCommand(player.createCommandSourceStack().withPermission(2), cmd);
        }
    }

    private void openGui(ServerPlayer player, String guiId) {
        switch (guiId) {
            // geen GUI's gekoppeld
            default -> ModMain.LOGGER.warn("[Story] onbekend gui: {}", guiId);
        }
    }
}

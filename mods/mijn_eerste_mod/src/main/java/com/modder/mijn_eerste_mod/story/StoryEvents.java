package com.modder.mijn_eerste_mod.story;

import net.fabricmc.fabric.api.entity.event.v1.ServerEntityCombatEvents;
import net.fabricmc.fabric.api.event.player.UseBlockCallback;
import net.fabricmc.fabric.api.event.player.UseItemCallback;
import net.fabricmc.fabric.api.networking.v1.ServerPlayConnectionEvents;
import net.fabricmc.fabric.api.event.lifecycle.v1.ServerTickEvents;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.InteractionResultHolder;

/**
 * Koppelt game-gebeurtenissen aan jouw verhaallijn.
 * Triggers die de app ondersteunt: join, kill, block, item, location.
 */
public final class StoryEvents {
    private StoryEvents() {}

    public static void register() {
        // Speler logt in
        ServerPlayConnectionEvents.JOIN.register((handler, sender, server) ->
                StoryManager.INSTANCE.onJoin(handler.player));

        // Iets doodmaken
        ServerEntityCombatEvents.AFTER_KILL_OTHER_ENTITY.register((world, entity, killed) -> {
            if (entity instanceof net.minecraft.server.level.ServerPlayer player) {
                StoryManager.INSTANCE.onKill(player, killed);
            }
        });

        // Blok rechtsklikken
        UseBlockCallback.EVENT.register((player, level, hand, hitResult) -> {
            if (!level.isClientSide && player instanceof net.minecraft.server.level.ServerPlayer sp) {
                StoryManager.INSTANCE.onInteractBlock(sp, hitResult);
            }
            return InteractionResult.PASS;
        });

        // Item rechtsklikken
        UseItemCallback.EVENT.register((player, level, hand) -> {
            if (!level.isClientSide && player instanceof net.minecraft.server.level.ServerPlayer sp) {
                StoryManager.INSTANCE.onInteractItem(sp, player.getItemInHand(hand));
            }
            return InteractionResultHolder.pass(player.getItemInHand(hand));
        });

        // Locatie-triggers (elke seconde)
        ServerTickEvents.END_WORLD_TICK.register(level ->
                StoryManager.INSTANCE.onWorldTick(level));
    }
}

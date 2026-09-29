package com.modder.mijn_eerste_mod.entity;

import net.minecraft.network.chat.Component;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.InteractionHand;
import net.minecraft.world.InteractionResult;
import net.minecraft.world.damagesource.DamageSource;
import net.minecraft.world.entity.EntityType;
import net.minecraft.world.entity.ai.attributes.AttributeSupplier;
import net.minecraft.world.entity.ai.attributes.Attributes;
import net.minecraft.world.entity.animal.Pig;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.entity.player.Player;
import net.minecraft.world.inventory.SimpleMenuProvider;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.level.Level;
import com.modder.mijn_eerste_mod.gui.GlitchMenu;
import com.modder.mijn_eerste_mod.ModItems;

import java.util.Random;

/**
 * g!li*tch.? – mod-mob gegenereerd door BlockyMod Studio (Mojang-mappings).
 * Op rechtermuisklik opent: glitch
 */
public class GLiTchEntity extends Pig {
    private static final Random RNG = new Random();

    public GLiTchEntity(EntityType<? extends Pig> entityType, Level level) {
        super(entityType, level);
        // 🎬 BlockyMod gedrag: jager – valt spelers aan
        this.goalSelector.addGoal(1, new net.minecraft.world.entity.ai.goal.MeleeAttackGoal(this, 1.2, true));
        this.targetSelector.addGoal(2, new net.minecraft.world.entity.ai.goal.target.NearestAttackableTargetGoal<>(this, net.minecraft.world.entity.player.Player.class, true));
    }
    // 🎬 BlockyMod animatie-triggers – koppel hier je animaties (of laat de AI het coderen!)
    private int bmTriggerTimer = 0;

    private void blockyModTriggers() {
        bmTriggerTimer++;
        if (this.tickCount % 100 == 0) {
            // ⏱ ELKE 5 SECONDEN: periodiek animatie-effect
        }
    }

    @Override
    public void aiStep() {
        super.aiStep();
        this.blockyModTriggers();
    }

    /** Basis-attributen (leven, snelheid, aanval). */
    public static AttributeSupplier.Builder createAttributes() {
        return Pig.createAttributes()
                .add(Attributes.MAX_HEALTH, 1000.0F)
                .add(Attributes.MOVEMENT_SPEED, 1.000F)
                .add(Attributes.ATTACK_DAMAGE, -16.5F);
    }

    /**
     * Rechtermuisklik op de mob → opent je GUI "glitch".
     */
    @Override
    protected InteractionResult mobInteract(Player player, InteractionHand hand) {

        if (!this.level().isClientSide && player instanceof ServerPlayer serverPlayer) {
            serverPlayer.openMenu(new SimpleMenuProvider(
                    (syncId, inv, p2) -> new GlitchMenu(syncId, inv),
                    Component.literal("glitch")));
            return InteractionResult.sidedSuccess(this.level().isClientSide);
        }
        return super.mobInteract(player, hand);
    }

    /** Drops bij dood. */
    @Override
    protected void dropCustomDeathLoot(DamageSource source, int looting, boolean recentlyHitByPlayer) {
        super.dropCustomDeathLoot(source, looting, recentlyHitByPlayer);
        if (this.level().isClientSide) return;
        if (RNG.nextFloat() <= 1.00F) {
            this.spawnAtLocation(new ItemStack(ModItems.GLITCHBENCH, 1));
        }
        if (RNG.nextFloat() <= 1.00F) {
            this.spawnAtLocation(new ItemStack(ModItems.GLITCH_TEXTURE, 10));
        }
    }
}

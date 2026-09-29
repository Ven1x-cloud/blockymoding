package com.modder.mijn_eerste_mod.client;

import net.fabricmc.api.EnvType;
import net.fabricmc.api.Environment;
import net.minecraft.client.gui.GuiGraphics;
import net.minecraft.client.gui.components.Button;
import net.minecraft.client.gui.screens.inventory.AbstractContainerScreen;
import net.minecraft.network.chat.Component;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.world.entity.player.Inventory;
import net.minecraft.world.inventory.Slot;
import pkg.ModMain;
import pkg.gui.GlitchMenu;

/**
 * Scherm voor "glitch" – tekent je zelf-ontworpen GUI-textuur.
 */
@Environment(EnvType.CLIENT)
public class GlitchScreen extends AbstractContainerScreen<GlitchMenu> {
    private static final ResourceLocation TEXTURE = ModMain.id("textures/gui/glitch.png");

    public GlitchScreen(GlitchMenu menu, Inventory inventory, Component title) {
        super(menu, inventory, title);
        this.imageWidth = 176;
        this.imageHeight = 166;
        this.titleLabelX = 4000; // verberg de standaard-titel (wij tekenen onze eigen labels)
    }

    @Override
    protected void init() {
        super.init();
        this.addRenderableWidget(Button.builder(Component.literal("glitch"), button -> {
            // TODO: jouw actie hier (of laat de AI dit in ai-code/ invullen)
        }).bounds(this.leftPos + 19, this.topPos + 132, 90, 20).build());
        this.addRenderableWidget(Button.builder(Component.literal("glitch"), button -> {
            // TODO: jouw actie hier (of laat de AI dit in ai-code/ invullen)
        }).bounds(this.leftPos + 14, this.topPos + 56, 90, 20).build());
        this.addRenderableWidget(Button.builder(Component.literal("glitch"), button -> {
            // TODO: jouw actie hier (of laat de AI dit in ai-code/ invullen)
        }).bounds(this.leftPos + 49, this.topPos + 72, 90, 20).build());
        this.addRenderableWidget(Button.builder(Component.literal("glitch"), button -> {
            // TODO: jouw actie hier (of laat de AI dit in ai-code/ invullen)
        }).bounds(this.leftPos + 83, this.topPos + 25, 90, 20).build());
        this.addRenderableWidget(Button.builder(Component.literal("glitch"), button -> {
            // TODO: jouw actie hier (of laat de AI dit in ai-code/ invullen)
        }).bounds(this.leftPos + 59, this.topPos + 104, 90, 20).build());
        this.addRenderableWidget(Button.builder(Component.literal("glitch"), button -> {
            // TODO: jouw actie hier (of laat de AI dit in ai-code/ invullen)
        }).bounds(this.leftPos + 51, this.topPos + 120, 90, 20).build());

    }

    @Override
    protected void renderBg(GuiGraphics g, float partialTick, int mouseX, int mouseY) {
        g.blit(TEXTURE, this.leftPos, this.topPos, 0, 0, this.imageWidth, this.imageHeight);
        g.drawString(this.font, "glitching..", this.leftPos + 12, this.topPos + 12, 0x404040, false);
    }

    @Override
    protected void renderSlot(GuiGraphics g, Slot slot) {
        // De slot-achtergrond zit al in je eigen textuur – teken alleen het item.
        g.renderItem(slot.getItem(), slot.x, slot.y);
        g.renderItemDecorations(this.font, slot.getItem(), slot.x, slot.y);
    }

    @Override
    public void render(GuiGraphics g, int mouseX, int mouseY, float delta) {
        super.render(g, mouseX, mouseY, delta);
        this.renderTooltip(g, mouseX, mouseY);
    }
}

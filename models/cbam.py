"""
CBAM - Convolutional Block Attention Module
Required for loading models trained with CBAM attention (malaria_multi, platelet)

This module must be imported before loading any CBAM-containing models so that
torch's unpickler can find the CBAM class definitions.

Reference: "CBAM: Convolutional Block Attention Module" (Woo et al., 2018)
"""
import torch
import torch.nn as nn


class ChannelAttention(nn.Module):
    """Channel attention module for CBAM"""
    def __init__(self, in_planes, ratio=16):
        super(ChannelAttention, self).__init__()
        self.avg_pool = nn.AdaptiveAvgPool2d(1)
        self.max_pool = nn.AdaptiveMaxPool2d(1)
        self.fc = nn.Sequential(
            nn.Conv2d(in_planes, in_planes // ratio, 1, bias=False),
            nn.ReLU(),
            nn.Conv2d(in_planes // ratio, in_planes, 1, bias=False)
        )
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg_out = self.fc(self.avg_pool(x))
        max_out = self.fc(self.max_pool(x))
        out = avg_out + max_out
        return self.sigmoid(out)


class SpatialAttention(nn.Module):
    """Spatial attention module for CBAM"""
    def __init__(self, kernel_size=7):
        super(SpatialAttention, self).__init__()
        self.conv1 = nn.Conv2d(2, 1, kernel_size, padding=kernel_size//2, bias=False)
        self.sigmoid = nn.Sigmoid()

    def forward(self, x):
        avg_out = torch.mean(x, dim=1, keepdim=True)
        max_out, _ = torch.max(x, dim=1, keepdim=True)
        x = torch.cat([avg_out, max_out], dim=1)
        x = self.conv1(x)
        return self.sigmoid(x)


class CBAM(nn.Module):
    """Convolutional Block Attention Module
    
    Combines channel and spatial attention to focus on important features.
    Used in YOLOv8 models trained with attention mechanisms.
    """
    def __init__(self, c1, kernel_size=7):
        super(CBAM, self).__init__()
        self.channel_attention = ChannelAttention(c1)
        self.spatial_attention = SpatialAttention(kernel_size)

    def forward(self, x):
        return x * self.channel_attention(x) * self.spatial_attention(x)


def register_cbam():
    """Register CBAM with ultralytics so models containing CBAM can be loaded"""
    try:
        import ultralytics.nn.tasks
        import ultralytics.nn.modules
        ultralytics.nn.tasks.CBAM = CBAM
        ultralytics.nn.tasks.ChannelAttention = ChannelAttention
        ultralytics.nn.tasks.SpatialAttention = SpatialAttention
        setattr(ultralytics.nn.modules, 'CBAM', CBAM)
        setattr(ultralytics.nn.modules, 'ChannelAttention', ChannelAttention)
        setattr(ultralytics.nn.modules, 'SpatialAttention', SpatialAttention)
    except Exception:
        pass  # Silently fail if ultralytics not available
    
    # Also inject into __main__ for pickle compatibility with models saved from notebooks
    import sys
    main_module = sys.modules.get('__main__')
    if main_module:
        setattr(main_module, 'CBAM', CBAM)
        setattr(main_module, 'ChannelAttention', ChannelAttention)
        setattr(main_module, 'SpatialAttention', SpatialAttention)


# Auto-register on import
register_cbam()

<script lang="ts">
  import { onMount, onDestroy, createEventDispatcher } from 'svelte';
  import Konva from 'konva';
  import type { MapFragment, Annotation, AssemblyScheme, ToolType, Point } from '@/types';
  import { SYSTEM_CONFIG } from '@/types';
  import { appStore } from '@/lib/store';

  export let scheme: AssemblyScheme | null = null;
  export let selectedFragmentId: string | null = null;
  export let selectedAnnotationId: string | null = null;
  export let activeTool: ToolType = 'select';
  export let readOnly: boolean = false;

  const dispatch = createEventDispatcher<{
    fragmentSelect: string | null;
    fragmentTransform: { id: string; x: number; y: number; rotation: number; scaleX: number; scaleY: number };
    fragmentDblClick: string;
    annotationSelect: string | null;
    annotationCreate: { type: string; fragmentId: string; data: Record<string, unknown> };
    canvasClick: { x: number; y: number };
  }>();

  let container: HTMLDivElement | null = null;
  let stage: Konva.Stage | null = null;
  let layer: Konva.Layer | null = null;
  let annotationLayer: Konva.Layer | null = null;
  let transformer: Konva.Transformer | null = null;
  let images: Map<string, HTMLImageElement> = new Map();
  let nodes: Map<string, Konva.Node> = new Map();
  let annotationNodes: Map<string, Konva.Node> = new Map();
  let drawingPoints: Point[] = [];
  let tempLine: Konva.Line | null = null;
  let isPanning = false;
  let panStart = { x: 0, y: 0 };

  const getFragmentLayer = () => layer;
  const getAnnotationLayer = () => annotationLayer;

  function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const existing = images.get(src);
      if (existing && existing.complete) {
        resolve(existing);
        return;
      }
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        images.set(src, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  function createFragmentNode(fragment: MapFragment): Konva.Image | null {
    const img = images.get(fragment.imageSrc);
    if (!img) return null;

    const node = new Konva.Image({
      id: `frag-${fragment.id}`,
      image: img,
      x: fragment.x,
      y: fragment.y,
      width: fragment.originalWidth,
      height: fragment.originalHeight,
      rotation: fragment.rotation,
      scaleX: fragment.scaleX,
      scaleY: fragment.scaleY,
      opacity: fragment.visible ? fragment.opacity : 0,
      draggable: !readOnly && activeTool === 'select' && fragment.visible,
    });

    node.on('dragend', () => {
      dispatch('fragmentTransform', {
        id: fragment.id,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      });
    });

    node.on('transformend', () => {
      dispatch('fragmentTransform', {
        id: fragment.id,
        x: node.x(),
        y: node.y(),
        rotation: node.rotation(),
        scaleX: node.scaleX(),
        scaleY: node.scaleY(),
      });
    });

    node.on('click tap', (e) => {
      e.cancelBubble = true;
      if (activeTool === 'select') {
        dispatch('fragmentSelect', fragment.id);
      } else if (activeTool.startsWith('annotate-')) {
        handleAnnotationClick(e, fragment);
      }
    });

    node.on('dblclick dbltap', (e) => {
      e.cancelBubble = true;
      dispatch('fragmentDblClick', fragment.id);
    });

    return node;
  }

  function handleAnnotationClick(e: Konva.KonvaEventObject<MouseEvent>, fragment: MapFragment) {
    const tool = activeTool;
    const ptr = e.target.getStage()?.getPointerPosition();
    if (!ptr) return;

    const local = { x: ptr.x, y: ptr.y };

    if (tool === 'annotate-place' || tool === 'annotate-note') {
      const type = tool === 'annotate-place' ? 'place' : 'note';
      dispatch('annotationCreate', {
        type,
        fragmentId: fragment.id,
        data: { position: local },
      });
      appStore.setActiveTool('select');
    } else if (tool === 'annotate-river' || tool === 'annotate-boundary') {
      drawingPoints.push(local);
      updateTempLine();
      if (drawingPoints.length >= 2 && e.evt?.shiftKey) {
        const type = tool === 'annotate-river' ? 'river' : 'boundary';
        dispatch('annotationCreate', {
          type,
          fragmentId: fragment.id,
          data: { points: [...drawingPoints], closed: type === 'boundary' },
        });
        clearDrawing();
        appStore.setActiveTool('select');
      }
    }
  }

  function updateTempLine() {
    if (tempLine) {
      tempLine.points(drawingPoints.flatMap((p) => [p.x, p.y]) as number[]);
      annotationLayer?.batchDraw();
    } else if (annotationLayer && drawingPoints.length > 0) {
      const isRiver = activeTool === 'annotate-river';
      tempLine = new Konva.Line({
        points: drawingPoints.flatMap((p) => [p.x, p.y]) as number[],
        stroke: isRiver ? '#2563eb' : '#9333ea',
        strokeWidth: isRiver ? 3 : 2,
        lineCap: 'round',
        lineJoin: 'round',
        dash: isRiver ? [] : [5, 5],
        opacity: 0.8,
      });
      annotationLayer.add(tempLine);
    }
  }

  function clearDrawing() {
    drawingPoints = [];
    if (tempLine) {
      tempLine.destroy();
      tempLine = null;
    }
    annotationLayer?.batchDraw();
  }

  function createAnnotationNode(annotation: Annotation): Konva.Node | null {
    let node: Konva.Node | null = null;

    switch (annotation.type) {
      case 'place': {
        const group = new Konva.Group({ id: `ann-${annotation.id}` });
        const circle = new Konva.Circle({
          x: annotation.position.x,
          y: annotation.position.y,
          radius: 6,
          fill: annotation.color,
          stroke: '#fff',
          strokeWidth: 2,
        });
        const label = new Konva.Text({
          x: annotation.position.x + 10,
          y: annotation.position.y - 8,
          text: annotation.label,
          fontSize: 14,
          fontFamily: 'Noto Serif SC, serif',
          fill: annotation.color,
          fontStyle: 'bold',
        });
        const bg = new Konva.Rect({
          x: label.x() - 2,
          y: label.y(),
          width: label.width() + 4,
          height: label.height(),
          fill: 'rgba(255,255,255,0.9)',
          cornerRadius: 2,
        });
        group.add(circle);
        group.add(bg);
        group.add(label);
        node = group;
        break;
      }
      case 'river': {
        node = new Konva.Line({
          id: `ann-${annotation.id}`,
          points: annotation.points.flatMap((p) => [p.x, p.y]) as number[],
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          lineCap: 'round',
          lineJoin: 'round',
          opacity: 0.85,
        });
        break;
      }
      case 'boundary': {
        node = new Konva.Line({
          id: `ann-${annotation.id}`,
          points: annotation.points.flatMap((p) => [p.x, p.y]) as number[],
          stroke: annotation.color,
          strokeWidth: annotation.strokeWidth,
          dash: [8, 4],
          lineCap: 'round',
          lineJoin: 'round',
          closed: annotation.closed,
          opacity: 0.85,
        });
        break;
      }
      case 'note': {
        const group = new Konva.Group({ id: `ann-${annotation.id}` });
        const label = new Konva.Text({
          x: annotation.position.x,
          y: annotation.position.y,
          text: annotation.label,
          fontSize: annotation.fontSize,
          fontFamily: 'Noto Serif SC, serif',
          fill: annotation.color,
          fontStyle: '500',
        });
        const padding = 4;
        const bg = new Konva.Rect({
          x: label.x() - padding,
          y: label.y() - padding,
          width: label.width() + padding * 2,
          height: label.height() + padding * 2,
          fill: 'rgba(253, 252, 249, 0.95)',
          stroke: annotation.color,
          strokeWidth: 1,
          cornerRadius: 4,
        });
        group.add(bg);
        group.add(label);
        node = group;
        break;
      }
    }

    if (node && !readOnly) {
      node.on('click tap', (e) => {
        e.cancelBubble = true;
        dispatch('annotationSelect', annotation.id);
      });
    }

    return node;
  }

  async function renderFragments() {
    if (!layer || !scheme) return;

    const validImages = scheme.fragments.filter((f) => images.has(f.imageSrc));
    const missing = scheme.fragments.filter((f) => !images.has(f.imageSrc));

    for (const f of missing) {
      try {
        await loadImage(f.imageSrc);
      } catch (e) {
        console.error('加载图片失败', f.name, e);
      }
    }

    layer.destroyChildren();
    nodes.clear();

    const sorted = [...scheme.fragments].sort((a, b) => a.zIndex - b.zIndex);
    for (const frag of sorted) {
      const node = createFragmentNode(frag);
      if (node) {
        layer.add(node);
        nodes.set(frag.id, node);
      }
    }

    if (transformer) {
      layer.add(transformer);
      updateTransformerSelection();
    }

    layer.batchDraw();
  }

  function renderAnnotations() {
    if (!annotationLayer || !scheme) return;

    annotationLayer.destroyChildren();
    annotationNodes.clear();

    for (const ann of scheme.annotations) {
      const node = createAnnotationNode(ann);
      if (node) {
        annotationLayer.add(node);
        annotationNodes.set(ann.id, node);
      }
    }

    if (tempLine) {
      annotationLayer.add(tempLine);
    }

    annotationLayer.batchDraw();
  }

  function updateTransformerSelection() {
    if (!transformer || !layer || !scheme) return;

    if (selectedFragmentId && !readOnly) {
      const node = nodes.get(selectedFragmentId);
      if (node && node instanceof Konva.Image) {
        transformer.nodes([node]);
        transformer.rotateEnabled(true);
        transformer.enabledAnchors([
          'top-left', 'top-right', 'bottom-left', 'bottom-right',
          'middle-left', 'middle-right', 'top-center', 'bottom-center'
        ]);
        transformer.boundBoxFunc((_, newBox) => {
          newBox.rotation = Math.max(
            SYSTEM_CONFIG.MIN_ROTATION,
            Math.min(SYSTEM_CONFIG.MAX_ROTATION, newBox.rotation)
          );
          const minDim = 10;
          const maxDim = 10000;
          newBox.width = Math.max(minDim, Math.min(maxDim, newBox.width));
          newBox.height = Math.max(minDim, Math.min(maxDim, newBox.height));
          return newBox;
        });
      } else {
        transformer.nodes([]);
      }
    } else {
      transformer.nodes([]);
    }

    layer.batchDraw();
  }

  function highlightSelectedAnnotation() {
    if (!scheme) return;
    for (const [id, node] of annotationNodes) {
      if (id === selectedAnnotationId) {
        if (node instanceof Konva.Line) {
          node.strokeWidth((node.strokeWidth() || 1) + 2);
        }
      }
    }
    annotationLayer?.batchDraw();
  }

  function handleWheel(e: WheelEvent) {
    if (!stage) return;
    e.preventDefault();
    const oldScale = stage.scaleX();
    const ptr = stage.getPointerPosition();
    if (!ptr) return;
    const mousePointTo = {
      x: (ptr.x - stage.x()) / oldScale,
      y: (ptr.y - stage.y()) / oldScale,
    };
    const direction = e.deltaY > 0 ? -1 : 1;
    const scaleBy = 1.05;
    const newScale = Math.max(0.1, Math.min(10, oldScale * (direction > 0 ? scaleBy : 1 / scaleBy)));
    stage.scale({ x: newScale, y: newScale });
    stage.position({
      x: ptr.x - mousePointTo.x * newScale,
      y: ptr.y - mousePointTo.y * newScale,
    });
    stage.batchDraw();
  }

  function handleStageMouseDown(e: Konva.KonvaEventObject<MouseEvent>) {
    if (e.target === e.target.getStage()) {
      if (activeTool === 'select' || activeTool === 'pan') {
        dispatch('fragmentSelect', null);
        dispatch('annotationSelect', null);
      }
      if (activeTool === 'pan') {
        isPanning = true;
        const pos = stage?.getPointerPosition();
        if (pos && stage) {
          panStart = { x: pos.x - stage.x(), y: pos.y - stage.y() };
          stage.container().style.cursor = 'grabbing';
        }
      }
    }
  }

  function handleStageMouseMove() {
    if (isPanning && stage) {
      const pos = stage.getPointerPosition();
      if (pos) {
        stage.position({ x: pos.x - panStart.x, y: pos.y - panStart.y });
        stage.batchDraw();
      }
    }
  }

  function handleStageMouseUp() {
    isPanning = false;
    if (stage) {
      stage.container().style.cursor = activeTool === 'pan' ? 'grab' : 'default';
    }
  }

  function resize() {
    if (!stage || !container) return;
    stage.width(container.clientWidth);
    stage.height(container.clientHeight);
    stage.batchDraw();
  }

  $: scheme, scheme && renderFragments();
  $: scheme && scheme.fragments.length && renderFragments();

  $: scheme, scheme && renderAnnotations();
  $: scheme && scheme.annotations.length && renderAnnotations();

  $: selectedFragmentId, scheme, updateTransformerSelection();

  $: selectedAnnotationId, scheme, (highlightSelectedAnnotation(), renderAnnotations());

  $: activeTool, stage && (() => {
    stage.container().style.cursor = activeTool === 'pan' ? 'grab' : 'default';
    for (const [id, node] of nodes) {
      if (node instanceof Konva.Image) {
        node.draggable(!readOnly && activeTool === 'select');
      }
    }
  })();

  $: if (activeTool !== 'annotate-river' && activeTool !== 'annotate-boundary') clearDrawing();

  onMount(() => {
    if (!container) return;

    stage = new Konva.Stage({
      container: container,
      width: container.clientWidth,
      height: container.clientHeight,
    });

    layer = new Konva.Layer();
    annotationLayer = new Konva.Layer();
    stage.add(layer);
    stage.add(annotationLayer);

    transformer = new Konva.Transformer({
      rotateAnchorOffset: 30,
      anchorSize: 10,
      borderStroke: '#b1893d',
      borderStrokeWidth: 1.5,
      anchorStroke: '#b1893d',
      anchorFill: '#fff',
      anchorStrokeWidth: 1.5,
    });
    layer.add(transformer);

    stage.on('wheel', handleWheel);
    stage.on('mousedown touchstart', handleStageMouseDown);
    stage.on('mousemove touchmove', handleStageMouseMove);
    stage.on('mouseup touchend', handleStageMouseUp);

    window.addEventListener('resize', resize);
    resize();
    renderFragments();
    renderAnnotations();
  });

  onDestroy(() => {
    window.removeEventListener('resize', resize);
    stage?.destroy();
  });
</script>

<div
  bind:this={container}
  class="w-full h-full bg-parchment-100 rounded-lg overflow-hidden relative"
  style="background-image:
    linear-gradient(rgba(193, 154, 107, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(193, 154, 107, 0.08) 1px, transparent 1px);
    background-size: 20px 20px;"
>
</div>

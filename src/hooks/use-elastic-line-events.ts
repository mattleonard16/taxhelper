/* eslint-disable react-hooks/refs */
import { useMemo, useRef } from "react"

import { useDimensions } from "@/hooks/use-dimensions"
import { useMousePosition } from "@/hooks/use-mouse-position"

interface ElasticLineEvents {
  isGrabbed: boolean
  controlPoint: { x: number; y: number }
}

export function useElasticLineEvents(
  containerRef: React.RefObject<SVGSVGElement | null>,
  isVertical: boolean,
  grabThreshold: number,
  releaseThreshold: number
): ElasticLineEvents {
  const mousePosition = useMousePosition(containerRef)
  const dimensions = useDimensions(containerRef)
  const isGrabbedRef = useRef(false)
  const prevDistanceRef = useRef<number | null>(null)

  const result = useMemo(() => {
    const { width, height } = dimensions
    const x = mousePosition.x
    const y = mousePosition.y

    // Default control point at center
    const centerPoint = {
      x: width / 2,
      y: height / 2,
    }

    // Check if mouse is outside container bounds
    const isOutsideBounds = x < 0 || x > width || y < 0 || y > height

    if (isOutsideBounds || !containerRef.current) {
      isGrabbedRef.current = false
      return { isGrabbed: false, controlPoint: centerPoint }
    }

    let distance: number
    let newControlPoint: { x: number; y: number }

    if (isVertical) {
      const midX = width / 2
      distance = Math.abs(x - midX)
      newControlPoint = {
        x: midX + 2.2 * (x - midX),
        y: y,
      }
    } else {
      const midY = height / 2
      distance = Math.abs(y - midY)
      newControlPoint = {
        x: x,
        y: midY + 2.2 * (y - midY),
      }
    }

    // Update grabbed state based on distance thresholds
    if (!isGrabbedRef.current && distance < grabThreshold) {
      isGrabbedRef.current = true
    } else if (isGrabbedRef.current && distance > releaseThreshold) {
      isGrabbedRef.current = false
    }

    prevDistanceRef.current = distance

    return {
      isGrabbed: isGrabbedRef.current,
      controlPoint: newControlPoint,
    }
  }, [mousePosition, dimensions, containerRef, isVertical, grabThreshold, releaseThreshold])

  return result
}



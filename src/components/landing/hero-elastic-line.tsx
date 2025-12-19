"use client";

import ElasticLine from "@/components/fancy/physics/elastic-line";

export function HeroElasticLine() {
    return (
        <div className="relative w-full h-8 my-4">
            <ElasticLine
                releaseThreshold={50}
                strokeWidth={1}
                className="text-primary/60"
                animateInTransition={{
                    type: "spring",
                    stiffness: 300,
                    damping: 30,
                    delay: 0.3,
                }}
            />
        </div>
    );
}

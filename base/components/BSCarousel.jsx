import React, { useState, useEffect } from 'react';
import { Carousel, CarouselControl, CarouselIndicators, CarouselItem, Button } from 'reactstrap';
import { space } from '../utils/miscutils';

/**
 * Wraps the BS Carousel to make it React user friendly.
 * @param {String} className
 * @param {?Boolean} hasIndicators display the circle indicators at the bottom
 * @param {?Boolean} hideArrows hide the left-right arrows at the sides
 * @param {?Boolean|Component} NextButton a custom component given the onClick next function of this carousel
 * @param {?Boolean} noWrap prevents the carousel starting again when reaching the end
 * @param {?Boolean} light light theme
 * @param {Component[]} children the slides to render
 * 
 */
const BSCarousel = ({className, hasIndicators, hideArrows, NextButton, noWrap, light, children}) => {
	const [animating, setAnimating] = useState(false);
	const [index, setIndex] = useState(0);

	// no nulls
	children = children.filter(x => x);

	const next = () => {
		if (animating) return;
		const nextIndex = index === children.length - 1 ? 0 : index + 1;
		if (nextIndex === 0 && noWrap) return;
		setIndex(nextIndex);
	}

	const previous = () => {
		if (animating) return;
		const nextIndex = index === 0 ? children.length - 1 : index - 1;
		if (nextIndex === children.length - 1 && noWrap) return;
		setIndex(nextIndex);
	}

	// For Dots/Indicators
	const goToIndex = (newIndex) => {
		if (animating) return;
		setIndex(newIndex);
	};

	return <>
		<Carousel className={space(className,'BSCarousel')}
			activeIndex={index}
			next={next}
			previous={previous}
			interval={false}
		>
			{children.map((content, i) =>
				<CarouselItem
					key={i}
					onExiting={() => setAnimating(true)}
					onExited={() => setAnimating(false)}
				>
					{content}
				</CarouselItem>
			)}
			{hasIndicators && <div className="d-block">
				<CarouselIndicators items={children} activeIndex={index} onClickHandler={goToIndex} />
			</div>}
			{!hideArrows && <div className={light&&"text-dark"}>
				<CarouselControl direction="prev" directionText="Previous" onClickHandler={previous} />
				<CarouselControl direction="next" directionText="Next" onClickHandler={next} />
			</div>}
		</Carousel>
		{NextButton && <NextButton onClick={next} index={index} length={children.length}/>}
	</>;
};

export default BSCarousel;


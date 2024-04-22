import React from "react";

const ChevronDownIcon = ({ className = "" }: { className: string }) => {
	return (
		<svg
			className={className}
			width='24px'
			height='24px'
			viewBox='0 0 20 20'
			xmlns='http://www.w3.org/2000/svg'
			fill='#000000'>
			<g id='SVGRepo_bgCarrier' strokeWidth='0'></g>
			<g
				id='SVGRepo_tracerCarrier'
				strokeLinecap='round'
				strokeLinejoin='round'></g>
			<g id='SVGRepo_iconCarrier'>
				<path
					d='M10 14a.997.997 0 01-.707-.293l-5-5a.999.999 0 111.414-1.414L10 11.586l4.293-4.293a.999.999 0 111.414 1.414l-5 5A.997.997 0 0110 14z'
					fill='#5C5F62'></path>
			</g>
		</svg>
	);
};

export default ChevronDownIcon;

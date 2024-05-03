import React, { useState } from "react";
import { Range } from "react-range";

interface Props {
	setFormState: React.Dispatch<React.SetStateAction<CollectionData>>;
	formState: CollectionData;
	floorPrice: number;
}

export interface CollectionData {
	collectionSymbol: string;
	minBid: number;
	maxBid: number;
	minFloorBid: number;
	maxFloorBid: number;
	outBidMargin: number;
	bidCount: number;
	duration: number;
	offerType: "ITEM" | "COLLECTION";
	fundingWalletWIF?: string;
	tokenReceiveAddress?: string;
	scheduledLoop?: number;
	counterbidLoop?: number;
}

const DualRangeSlider: React.FC<Props> = ({
	setFormState,
	floorPrice,
	formState,
}) => {
	// get collections data

	console.log({ formState });

	const { minFloorBid, maxFloorBid } = formState;

	const [values, setValues] = useState([minFloorBid, maxFloorBid]);

	const handleChange = (newValues: number[]) => {
		if (
			newValues[0] >= 50 &&
			newValues[1] <= 100 &&
			newValues[0] < newValues[1]
		) {
			setValues(newValues);
			setFormState((prevState) => ({
				...prevState,
				minFloorBid: newValues[0],
				maxFloorBid: newValues[1],
			}));
		}
	};

	return (
		<div className='mt-6'>
			<label
				htmlFor='floor_bid_range'
				className='block mb-2 text-sm font-medium text-white'>
				{floorPrice ? `FLOOR BID RANGE (${floorPrice})` : "FLOOR BID RANGE"}
			</label>
			<div className='relative'>
				<Range
					step={1}
					min={0}
					max={100}
					values={values}
					onChange={(newValues) => handleChange(newValues)}
					renderTrack={({ props, children }) => (
						<div
							{...props}
							className='w-full h-1 bg-gray-200 rounded-full cursor-pointer dark:bg-gray-700'
							style={{ outline: "none" }}>
							{children}
						</div>
					)}
					renderThumb={({ props }) => (
						<div
							{...props}
							className='absolute top-0 w-4 h-4 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none'
						/>
					)}
				/>
				<div
					className='absolute top-0 bottom-0 left-0 right-0 pointer-events-none rounded-full'
					style={{
						background: `linear-gradient(to right, #CB3CFF ${values[0]}%, #7F25FB ${values[1]}%)`,
					}}
				/>
				<div
					className='absolute top-1/2 w-4 h-4 bg-white rounded-full transform -translate-x-1/2 -translate-y-1/2 pointer-events-none'
					style={{
						left: `${values[0]}%`,
					}}
				/>
				<div
					className='absolute top-1/2 w-4 h-4 bg-white rounded-full transform translate-x-1/2 -translate-y-1/2 pointer-events-none'
					style={{
						left: `${values[1]}%`,
					}}
				/>
			</div>
			<div className='flex justify-between text-sm text-white mt-2'>
				{values[0]}%{" "}
				{floorPrice ? `(${((values[0] * floorPrice) / 100).toFixed(8)})` : ""}
				<span>
					{values[1]}%{" "}
					{floorPrice ? `(${((values[1] * floorPrice) / 100).toFixed(8)})` : ""}
				</span>
			</div>
		</div>
	);
};

export default DualRangeSlider;

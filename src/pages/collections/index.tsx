import PlusIcon from "@/assets/icons/PlusIcon";
import { useCollectionsState } from "@/store/collections.store";
import React, { useState } from "react";

const CollectionForm: React.FC = () => {
	const [isOpen, setIsOpen] = useState(false);
	const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

	const [formState, setFormState] = useState<CollectionData>({
		collectionSymbol: "",
		minBid: 0,
		maxBid: 0,
		minFloorBid: 0,
		maxFloorBid: 0,
		outBidMargin: 0,
		bidCount: 0,
		duration: 0,
		fundingWalletWIF: "",
		tokenReceiveAddress: "",
		scheduledLoop: 0,
		counterbidLoop: 0,
	});

	const handleSelectAllChange = (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setSelectedCollections(
			event.target.checked
				? collections.map((collection) => collection.collectionSymbol)
				: []
		);
	};

	const handleRemoveCollection = (index: number) => {
		removeCollection(index);
	};

	const handleCheckboxChange = (collectionSymbol: string) => {
		const selectedIndex = selectedCollections.indexOf(collectionSymbol);
		let newSelectedCollections: string[] = [];

		if (selectedIndex === -1) {
			newSelectedCollections = [...selectedCollections, collectionSymbol];
		} else {
			newSelectedCollections = selectedCollections.filter(
				(symbol) => symbol !== collectionSymbol
			);
		}

		setSelectedCollections(newSelectedCollections);
	};

	const { collections, removeCollection, addCollection } =
		useCollectionsState();

	const handleInputChange = (
		e: React.ChangeEvent<HTMLInputElement>,
		field: keyof CollectionData
	) => {
		const value = e.target.value;
		setFormState((prevState) => ({
			...prevState,
			[field]: value,
		}));
	};

	const handleNumberInputChange = (
		e: React.ChangeEvent<HTMLInputElement>,
		field: keyof CollectionData
	) => {
		const value = e.target.value;
		if (value === "" || (Number(value) >= 0 && Number(value) < Infinity)) {
			setFormState((prevState) => ({
				...prevState,
				[field]: value,
			}));
		}
	};

	const handleAddCollection = () => {
		addCollection(formState);
		// Reset form state after adding the collection
		setFormState({
			collectionSymbol: "",
			minBid: 0,
			maxBid: 0,
			minFloorBid: 0,
			maxFloorBid: 0,
			outBidMargin: 0,
			bidCount: 0,
			duration: 0,
			fundingWalletWIF: "",
			tokenReceiveAddress: "",
			scheduledLoop: 0,
			counterbidLoop: 0,
		});

		// Close the modal after adding the collection
		setIsOpen(false);
	};

	return (
		<div className='py-[30px] px-[40px]'>
			<h2 className='text-white text-[20px] font-semibold'>Collection Data</h2>
			<p className='mt-2 text-[14px] font-medium text-[#AEB9E1]'>
				Enter collection details
			</p>

			<div className='flex justify-end'>
				<button
					className='bg-[#CB3CFF] px-3 py-[14px] w-[180px] font-semibold text-white text-sm rounded flex justify-center items-center gap-3 mt-6'
					onClick={() => setIsOpen(true)}>
					Add New
					<PlusIcon />
				</button>
			</div>

			<div className='mt-6'>
				<div className='relative overflow-x-auto shadow-md'>
					<table
						className='w-full text-sm text-left text-white border border-[#343B4F] rounded-lg'
						style={{ borderRadius: "12px" }}>
						<thead className='text-xs bg-[#0A1330]'>
							<tr>
								<th scope='col' className='p-4'>
									<div className='flex items-center'>
										<input
											id='checkbox-all-search'
											type='checkbox'
											className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-[#CB3CFF] dark:focus:ring-[#CB3CFF] dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
											checked={
												selectedCollections.length === collections.length
											}
											onChange={handleSelectAllChange}
										/>
										<label htmlFor='checkbox-all-search' className='sr-only'>
											checkbox
										</label>
									</div>
								</th>
								<th scope='col' className='px-6 py-5'>
									Collection Symbol
								</th>
								<th scope='col' className='px-6 py-5'>
									Min Bid
								</th>
								<th scope='col' className='px-6 py-5'>
									Max Bid
								</th>
								<th scope='col' className='px-6 py-5'>
									Min Floor Bid
								</th>
								<th scope='col' className='px-6 py-5'>
									Max Floor Bid
								</th>
								<th scope='col' className='px-6 py-5'>
									Outbid Margin
								</th>
								<th scope='col' className='px-6 py-5'>
									Bid Count
								</th>
								<th scope='col' className='px-6 py-5'>
									Duration
								</th>
								<th scope='col' className='px-6 py-5'>
									Action
								</th>
							</tr>
						</thead>
						<tbody>
							{collections.map((collection, index) => (
								<tr
									key={index}
									className={`${
										index % 2 === 0 ? "bg-[#0b1739]" : "bg-[#091330]"
									}`}>
									<td className='w-4 p-4'>
										<div className='flex items-center'>
											<input
												id={`checkbox-table-search-${index}`}
												type='checkbox'
												className='w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
												checked={selectedCollections.includes(
													collection.collectionSymbol
												)}
												onChange={() =>
													handleCheckboxChange(collection.collectionSymbol)
												}
											/>
											<label
												htmlFor={`checkbox-table-search-${index}`}
												className='sr-only'>
												checkbox
											</label>
										</div>
									</td>
									<th
										scope='row'
										className='px-6 py-5 font-medium text-gray-900 whitespace-nowrap dark:text-white'>
										{collection.collectionSymbol}
									</th>
									<td className='px-6 py-5'>{collection.minBid}</td>
									<td className='px-6 py-5'>{collection.maxBid}</td>
									<td className='px-6 py-5'>{collection.minFloorBid}</td>
									<td className='px-6 py-5'>{collection.maxFloorBid}</td>
									<td className='px-6 py-5'>{collection.outBidMargin}</td>
									<td className='px-6 py-5'>{collection.bidCount}</td>
									<td className='px-6 py-5'>{collection.duration}</td>
									<td className='flex items-center px-6 py-5'>
										<a
											href='#'
											className='font-medium text-blue-600 dark:text-blue-500 hover:underline'>
											Edit
										</a>
										<button
											onClick={() => handleRemoveCollection(index)}
											className='font-medium text-red-600 dark:text-red-500 hover:underline ms-3'>
											Remove
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>

			{isOpen && (
				<div className='fixed inset-0 flex items-center justify-center z-50'>
					<div className='mt-6 w-[768px] border border-[#343B4F] rounded-xl p-8 bg-[#0b1739]'>
						<div className='flex justify-between items-center mb-6'>
							<h2 className='text-xl font-semibold text-white'>
								Add New Collection
							</h2>
							<button
								className='text-white hover:text-gray-300'
								onClick={() => setIsOpen(false)}>
								<svg
									xmlns='http://www.w3.org/2000/svg'
									className='h-6 w-6'
									fill='none'
									viewBox='0 0 24 24'
									stroke='currentColor'>
									<path
										strokeLinecap='round'
										strokeLinejoin='round'
										strokeWidth={2}
										d='M6 18L18 6M6 6l12 12'
									/>
								</svg>
							</button>
						</div>
						<div>
							<label
								htmlFor='collection_symbol'
								className='block mb-2 text-sm font-medium text-white'>
								COLLECTION SYMBOL
							</label>
							<input
								type='text'
								id='collection_symbol'
								className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white'
								placeholder=''
								value={formState.collectionSymbol}
								onChange={(e) => handleInputChange(e, "collectionSymbol")}
								required
							/>
						</div>
						<div className='mt-6'>
							<label
								htmlFor='token_receive_address'
								className='block mb-2 text-sm font-medium text-white'>
								TOKEN RECEIVE ADDRESS
							</label>
							<input
								type='text'
								id='token_receive_address'
								className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white'
								placeholder=''
								value={formState.tokenReceiveAddress}
								onChange={(e) => handleInputChange(e, "tokenReceiveAddress")}
							/>
						</div>

						<div className='mt-6'>
							<label
								htmlFor='funding_wallet_wif'
								className='block mb-2 text-sm font-medium text-white'>
								FUNDING WALLET WIF
							</label>
							<input
								type='text'
								id='funding_wallet_wif'
								className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white'
								placeholder=''
								value={formState.fundingWalletWIF}
								onChange={(e) => handleInputChange(e, "fundingWalletWIF")}
							/>
						</div>
						<div className='mt-6 flex space-x-4'>
							<div>
								<label
									htmlFor='min_bid'
									className='block mb-2 text-sm font-medium text-white'>
									MIN BID
								</label>
								<input
									type='number'
									id='min_bid'
									className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
									placeholder=''
									inputMode='numeric'
									value={formState.minBid}
									onChange={(e) => handleNumberInputChange(e, "minBid")}
									required
								/>
							</div>
							<div>
								<label
									htmlFor='max_bid'
									className='block mb-2 text-sm font-medium text-white'>
									MAX BID
								</label>
								<input
									type='number'
									id='max_bid'
									className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
									placeholder=''
									inputMode='numeric'
									value={formState.maxBid}
									onChange={(e) => handleNumberInputChange(e, "maxBid")}
									required
								/>
							</div>
						</div>
						<div className='mt-6 flex space-x-4'>
							<div>
								<label
									htmlFor='min_floor_bid'
									className='block mb-2 text-sm font-medium text-white'>
									MIN FLOOR BID
								</label>
								<input
									type='number'
									id='min_floor_bid'
									className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
									placeholder=''
									inputMode='numeric'
									value={formState.minFloorBid}
									onChange={(e) => handleNumberInputChange(e, "minFloorBid")}
									required
								/>
							</div>
							<div>
								<label
									htmlFor='max_floor_bid'
									className='block mb-2 text-sm font-medium text-white'>
									MAX FLOOR BID
								</label>
								<input
									type='number'
									id='max_floor_bid'
									className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
									placeholder=''
									inputMode='numeric'
									value={formState.maxFloorBid}
									onChange={(e) => handleNumberInputChange(e, "maxFloorBid")}
									required
								/>
							</div>
						</div>

						<div className='mt-6 flex space-x-4'>
							<div>
								<label
									htmlFor='scheduled_loop'
									className='block mb-2 text-sm font-medium text-white'>
									SCHEDULED LOOP
								</label>
								<input
									type='number'
									id='scheduled_loop'
									className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
									placeholder=''
									inputMode='numeric'
									value={formState.scheduledLoop}
									onChange={(e) => handleNumberInputChange(e, "scheduledLoop")}
								/>
							</div>
							<div>
								<label
									htmlFor='counterbid_loop'
									className='block mb-2 text-sm font-medium text-white'>
									COUNTERBID LOOP
								</label>
								<input
									type='number'
									id='counterbid_loop'
									className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
									placeholder=''
									inputMode='numeric'
									value={formState.counterbidLoop}
									onChange={(e) => handleNumberInputChange(e, "counterbidLoop")}
								/>
							</div>
						</div>
						<div className='mt-6 flex space-x-4'>
							<div>
								<label
									htmlFor='out_bid_margin'
									className='block mb-2 text-sm font-medium text-white'>
									OUT BID MARGIN
								</label>
								<input
									type='number'
									id='out_bid_margin'
									className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
									placeholder=''
									inputMode='numeric'
									value={formState.outBidMargin}
									onChange={(e) => handleNumberInputChange(e, "outBidMargin")}
									required
								/>
							</div>
							<div>
								<label
									htmlFor='bid_count'
									className='block mb-2 text-sm font-medium text-white'>
									BID COUNT
								</label>
								<input
									type='number'
									id='bid_count'
									className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
									placeholder=''
									inputMode='numeric'
									value={formState.bidCount}
									onChange={(e) => handleNumberInputChange(e, "bidCount")}
									required
								/>
							</div>
							<div>
								<label
									htmlFor='duration'
									className='block mb-2 text-sm font-medium text-white'>
									DURATION
								</label>
								<input
									type='number'
									id='duration'
									className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
									placeholder=''
									inputMode='numeric'
									value={formState.duration}
									onChange={(e) => handleNumberInputChange(e, "duration")}
									required
								/>
							</div>
						</div>

						<div className='flex justify-end mt-6'>
							<button
								className='bg-[#CB3CFF] py-[14px] w-[180px] font-semibold text-white text-sm rounded'
								onClick={handleAddCollection}>
								ADD
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default CollectionForm;

export interface CollectionData {
	collectionSymbol: string;
	minBid: number;
	maxBid: number;
	minFloorBid: number;
	maxFloorBid: number;
	outBidMargin: number;
	bidCount: number;
	duration: number;
	fundingWalletWIF?: string;
	tokenReceiveAddress?: string;
	scheduledLoop?: number;
	counterbidLoop?: number;
}

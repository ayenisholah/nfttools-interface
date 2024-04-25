import CheckIcon from "@/assets/icons/CheckIcon";
import ChevronDownIcon from "@/assets/icons/ChevronDownIcon";
import PlusIcon from "@/assets/icons/PlusIcon";
import DualRangeSlider from "@/components/DualRangeSlider";
import { useAccountState } from "@/store/account.store";
import { useCollectionsState } from "@/store/collections.store";
import { useSettingsState } from "@/store/settings.store";
import Link from "next/link";
import React, { useEffect, useState } from "react";
import { toast } from "react-toastify";

const CollectionForm: React.FC = () => {
	const [isOpen, setIsOpen] = useState(false);
	const [openDropDown, setOpenDropdown] = useState(false);
	const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
	const [isOrdinalAddress, setIsOrdinalAddress] = useState(false);
	const { wallets } = useAccountState();
	const [collectionDetails, setCollectionDetails] = useState({
		floorPrice: 0,
		symbol: "",
	});
	const { apiKey, rateLimit } = useSettingsState();
	const [selectedWallet, setSelectedWallet] = useState("");
	const [formState, setFormState] = useState<CollectionData>({
		collectionSymbol: "",
		minBid: 0,
		maxBid: 0,
		minFloorBid: 50,
		maxFloorBid: 75,
		outBidMargin: 1e-6,
		bidCount: 10,
		duration: 10,
		fundingWalletWIF: "",
		tokenReceiveAddress: "",
		scheduledLoop: 600,
		counterbidLoop: 600,
		floorPrice: 0,
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
		if (!collectionDetails.symbol || !collectionDetails.floorPrice) {
			toast.error("Please enter a valid collection symbol.");
			return;
		}

		if (!isOrdinalAddress) {
			toast.error("Please enter a valid ordinal address.");
			return;
		}
		addCollection(formState);
		setFormState({
			collectionSymbol: "",
			minBid: 0,
			maxBid: 0,
			minFloorBid: 50,
			maxFloorBid: 75,
			outBidMargin: 1e-6,
			bidCount: 10,
			duration: 10,
			fundingWalletWIF: "",
			tokenReceiveAddress: "",
			scheduledLoop: 600,
			counterbidLoop: 600,
		});

		setIsOrdinalAddress(false);
		setCollectionDetails({
			symbol: "",
			floorPrice: 0,
		});
		setIsOpen(false);
	};

	useEffect(() => {
		async function getCollection() {
			try {
				const response = await fetch("/api/collection/validate", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						collectionSymbol: formState.collectionSymbol,
						apiKey,
					}),
				});

				if (!response.ok) {
					throw new Error("Network response was not ok");
				}

				const collection = await response.json();

				setCollectionDetails({
					symbol: collection.symbol,
					floorPrice: Number((+collection.floorPrice / 1e8).toFixed(9)),
				});

				setFormState((prev) => ({
					...prev,
					minBid: (+collection.floorPrice / 1e8) * 0.5,
					maxBid: +collection.floorPrice / 1e8,
					floorPrice: Number((+collection.floorPrice / 1e8).toFixed(9)),
				}));
			} catch (error) {
				console.error(error);
			}
		}

		if (apiKey && formState.collectionSymbol) {
			getCollection();
		}
	}, [apiKey, formState.collectionSymbol]);

	useEffect(() => {
		async function validateAddress() {
			try {
				const response = await fetch(
					`/api/account/validate?address=${formState.tokenReceiveAddress}`
				);

				if (!response.ok) {
					throw new Error("Network response was not ok");
				}
				const isOrdinalAddress = await response.json();

				setIsOrdinalAddress(isOrdinalAddress);
			} catch (error) {
				console.error(error);
			}
		}

		if (formState.tokenReceiveAddress) {
			validateAddress();
		}
	}, [formState.tokenReceiveAddress]);

	const toggleDropdown = () => {
		setOpenDropdown(!openDropDown);
	};

	const handleWalletChange = (privateKey: string) => {
		setSelectedWallet(privateKey);
		setFormState((prev) => ({ ...prev, fundingWalletWIF: privateKey }));
		setOpenDropdown(false);
	};

	return (
		<div className='relative'>
			{!apiKey ? (
				<span className='bg-red-100 text-red-800 text-xs font-medium absolute top-4 right-4 m-2 px-2.5 py-0.5 rounded'>
					NFT TOOLS API KEY not set, please add key in &nbsp;
					<Link href='/settings' className='underline'>
						settings
					</Link>
				</span>
			) : !rateLimit ? (
				<span className='bg-red-100 text-red-800 text-xs font-medium absolute top-4 right-4 m-2 px-2.5 py-0.5 rounded'>
					Rate not set, please add key in &nbsp;
					<Link href='/settings' className='underline'>
						settings
					</Link>
				</span>
			) : null}

			<div className='py-[30px] px-[40px]'>
				<h2 className='text-white text-[20px] font-semibold'>
					Collection Data
				</h2>
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

				{collections.length > 0 ? (
					<div className='mt-6'>
						<div className='relative overflow-x-auto shadow-md'>
							<table className='w-full text-sm text-left text-white border border-[#343B4F] rounded-lg'>
								<thead className='text-xs bg-[#0A1330]'>
									<tr>
										<th scope='col' className='p-4'>
											<div className='flex items-center'>
												<input
													id='checkbox-all-search'
													type='checkbox'
													className='w-4 h-4 text-[#CB3CFF] bg-gray-100 border-gray-300 rounded focus:ring-[#CB3CFF] dark:focus:ring-[#CB3CFF] dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
													checked={
														selectedCollections.length === collections.length
													}
													onChange={handleSelectAllChange}
													style={{ accentColor: "#CB3CFF" }}
												/>
												<label
													htmlFor='checkbox-all-search'
													className='sr-only'>
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
														className='w-4 h-4 text-[#CB3CFF] bg-gray-100 border-gray-300 rounded focus:ring-[#CB3CFF] dark:focus:ring-[#CB3CFF] dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
														style={{ accentColor: "#CB3CFF" }}
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
												<button
													className='font-medium text-blue-600 dark:text-blue-500 hover:underline'
													onClick={() => {
														setIsOpen(true);
													}}>
													Edit
												</button>
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
				) : null}

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
									className='mb-2 text-sm font-medium text-white flex gap-2 items-center'>
									COLLECTION SYMBOL
									{collectionDetails.symbol && collectionDetails.floorPrice ? (
										<CheckIcon />
									) : null}
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
									className='mb-2 text-sm font-medium text-white flex gap-2'>
									TOKEN RECEIVE ADDRESS (ordinal address)
									{isOrdinalAddress ? <CheckIcon /> : null}
								</label>
								<input
									type='text'
									id='token_receive_address'
									className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white'
									placeholder=''
									value={formState.tokenReceiveAddress}
									onChange={(e) => handleInputChange(e, "tokenReceiveAddress")}
								/>

								{formState.tokenReceiveAddress && !isOrdinalAddress ? (
									<span className='bg-yellow-100 text-yellow-800 text-xs font-medium me-2 px-2.5 py-0.5 rounded dark:bg-yellow-900 dark:text-yellow-300'>
										⚠️ This address is not a valid ordinal address
									</span>
								) : null}
							</div>
							<div className='mt-6 relative'>
								<label
									htmlFor='funding_wif'
									className='block mb-2 text-sm font-medium text-white'>
									FUNDING WIF
								</label>
								<div className='relative'>
									<button
										type='button'
										className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white flex items-center justify-between'
										onClick={toggleDropdown}>
										<span
											className={
												selectedWallet ? "text-white" : "text-gray-400"
											}>
											{selectedWallet
												? wallets.find(
														(wallet) => wallet.privateKey === selectedWallet
												  )?.privateKey
												: "Select a wallet"}
										</span>
										<ChevronDownIcon
											className={`w-5 h-5 ml-2 transition-transform ${
												openDropDown ? "transform rotate-180" : ""
											}`}
										/>
									</button>
									{openDropDown && (
										<div className='absolute z-10 w-full bg-[#1A2342] border border-[#343B4F] rounded shadow-lg mt-1'>
											{wallets.map((wallet, index) => (
												<div
													key={index}
													className={`p-[14px] text-white cursor-pointer hover:bg-[#343B4F] ${
														selectedWallet === wallet.privateKey
															? "bg-[#343B4F]"
															: ""
													}`}
													onClick={() => handleWalletChange(wallet.privateKey)}>
													{wallet.label}
												</div>
											))}
										</div>
									)}
								</div>
								<div className='mt-2'>
									<Link href='/accounts' className='text-white underline'>
										Add a new key
									</Link>
								</div>
							</div>

							<DualRangeSlider
								setFormState={setFormState}
								floorPrice={collectionDetails.floorPrice}
							/>

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
										placeholder={
											collectionDetails.floorPrice
												? (collectionDetails.floorPrice * 0.5).toString()
												: ""
										}
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
										htmlFor='scheduled_loop'
										className='block mb-2 text-sm font-medium text-white'>
										SCHEDULED LOOP (seconds)
									</label>
									<input
										type='number'
										id='scheduled_loop'
										className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
										placeholder=''
										inputMode='numeric'
										value={formState.scheduledLoop}
										onChange={(e) =>
											handleNumberInputChange(e, "scheduledLoop")
										}
									/>
								</div>
								<div>
									<label
										htmlFor='counterbid_loop'
										className='block mb-2 text-sm font-medium text-white'>
										COUNTERBID LOOP (seconds)
									</label>
									<input
										type='number'
										id='counterbid_loop'
										className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
										placeholder=''
										inputMode='numeric'
										value={formState.counterbidLoop}
										onChange={(e) =>
											handleNumberInputChange(e, "counterbidLoop")
										}
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
									className={`py-[14px] w-[180px] font-semibold text-sm rounded ${
										!collectionDetails.symbol ||
										!collectionDetails.floorPrice ||
										!isOrdinalAddress
											? "bg-gray-400 cursor-not-allowed"
											: "bg-[#CB3CFF] text-white"
									}`}
									onClick={handleAddCollection}
									disabled={
										!collectionDetails.symbol ||
										!collectionDetails.floorPrice ||
										!isOrdinalAddress
									}>
									ADD
								</button>
							</div>
						</div>
					</div>
				)}
			</div>
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
	floorPrice?: number;
}

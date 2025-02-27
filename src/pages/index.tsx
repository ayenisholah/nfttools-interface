import CheckIcon from "@/assets/icons/CheckIcon";
import ChevronDownIcon from "@/assets/icons/ChevronDownIcon";
import PlusIcon from "@/assets/icons/PlusIcon";
import DualRangeSlider from "@/components/DualRangeSlider";
import { useAccountState } from "@/store/account.store";
import { BidState, useBidStateStore } from "@/store/bid.store";
import { useCollectionsState } from "@/store/collections.store";
import { useSettingsState } from "@/store/settings.store";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";

export default function Home() {
	const {
		apiKey,
		rateLimit,
		fundingWif,
		tokenReceiveAddress: defaultTokenReceiveAddress,
		bidExpiration,
		defaultLoopTime,
	} = useSettingsState();
	const { bidStates, startAll, stopAll, startBid, stopBid } =
		useBidStateStore();
	const { collections, removeCollection, addCollection, editCollection } =
		useCollectionsState();
	const { wallets } = useAccountState();

	const [isOrdinalAddress, setIsOrdinalAddress] = useState(false);
	const [openDropDown, setOpenDropdown] = useState(false);
	const [selectedWallet, setSelectedWallet] = useState("");

	const [offerType, setOfferType] = useState<"ITEM" | "COLLECTION">("ITEM");
	const [openOfferTypeDropdown, setOpenOfferTypeDropdown] = useState(false);

	const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
	const [data, setData] = useState<BidState[]>([]);
	const [editIndex, setEditIndex] = useState<number | null>(null);

	const [isOpen, setIsOpen] = useState(false);
	const [collectionDetails, setCollectionDetails] = useState({
		floorPrice: 0,
		symbol: "",
	});

	const [formState, setFormState] = useState<CollectionData>({
		collectionSymbol: "",
		quantity: 1,
		minBid: 0,
		maxBid: 0,
		minFloorBid: 50,
		maxFloorBid: 75,
		outBidMargin: 1e-6,
		bidCount: 10,
		duration: 10,
		fundingWalletWIF: "",
		enableCounterbidding: true,
		tokenReceiveAddress: "",
		scheduledLoop: 600,
		floorPrice: 0,
		offerType: "ITEM",
	});

	const handleSelectAllBidsChange = (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setSelectedCollections(
			event.target.checked
				? bidStates.map((bidState) => bidState.collectionSymbol)
				: []
		);
	};

	const toggleDropdown = () => {
		setOpenDropdown(!openDropDown);
	};

	const handleBidCheckboxChange = (collectionSymbol: string) => {
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

	useEffect(() => {
		if (bidStates.length > 0) {
			setData(bidStates);
		}
	}, [bidStates]);

	const combinedCollections = useMemo(() => {
		return collections.map((collection) => {
			const bidState = bidStates.find(
				(bid) => bid.collectionSymbol === collection.collectionSymbol
			);

			return {
				collectionSymbol: collection.collectionSymbol,
				offerType: collection.offerType,
				minBid: collection.minBid,
				maxBid: collection.maxBid,
				minFloorBid: collection.minFloorBid,
				maxFloorBid: collection.maxFloorBid,
				outBidMargin: collection.outBidMargin,
				bidCount: collection.bidCount,
				fundingWalletWIF: collection.fundingWalletWIF || fundingWif,
				tokenReceiveAddress:
					collection.tokenReceiveAddress || defaultTokenReceiveAddress,
				duration: collection.duration || bidExpiration,
				scheduledLoop: collection.scheduledLoop || defaultLoopTime,
				running: bidState?.running || false,
			};
		});
	}, [
		collections,
		bidStates,
		fundingWif,
		defaultTokenReceiveAddress,
		bidExpiration,
		defaultLoopTime,
	]);

	function handleClose() {
		setIsOpen(false);

		setFormState({
			quantity: 1,
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
			offerType: "ITEM",
			enableCounterbidding: true,
		});
		setEditIndex(null);

		setIsOrdinalAddress(false);
		setCollectionDetails({
			symbol: "",
			floorPrice: 0,
		});
	}

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

	const handleToggleChange = (field: keyof CollectionData) => {
		setFormState((prevState) => ({
			...prevState,
			[field]: !prevState[field],
		}));
	};

	const handleWalletChange = (address: string) => {
		const foundWallet = wallets.find(
			(item) => item.address.toLowerCase() === address.toLowerCase()
		);

		if (foundWallet) {
			setFormState((prev) => ({
				...prev,
				fundingWalletWIF: foundWallet.privateKey,
			}));

			setSelectedWallet(address);
		}
		setSelectedWallet(address);
		setOpenDropdown(false);
	};

	const handleAddCollection = () => {
		if (!collectionDetails.symbol || !collectionDetails.floorPrice) {
			toast.error("Please enter a valid collection symbol.");
			return;
		}

		if (!isOrdinalAddress && !defaultTokenReceiveAddress) {
			toast.error("Please enter a valid ordinal address.");
			return;
		}

		if (editIndex !== null) {
			editCollection(editIndex, formState);
		} else {
			addCollection(formState);
		}

		setFormState({
			quantity: 1,
			collectionSymbol: "",
			minBid: 0,
			maxBid: 0,
			minFloorBid: 50,
			maxFloorBid: 75,
			outBidMargin: 1e-6,
			bidCount: 10,
			duration: 10,
			enableCounterbidding: true,
			fundingWalletWIF: "",
			tokenReceiveAddress: "",
			scheduledLoop: 600,
			offerType: "ITEM",
		});
		setEditIndex(null);
		setIsOpen(false);

		setIsOrdinalAddress(false);
		setCollectionDetails({
			symbol: "",
			floorPrice: 0,
		});
	};

	const onEdit = (index: number) => {
		setEditIndex(index);
		const collectionToEdit = collections[index];
		setFormState(collectionToEdit);
		setIsOpen(true);
	};

	const handleRemoveCollection = (index: number) => {
		removeCollection(index);
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

				if (formState.minBid === 0 || formState.maxBid === 0) {
					setFormState((prev) => ({
						...prev,
						minBid: (+collection.floorPrice / 1e8) * 0.5,
						maxBid: +collection.floorPrice / 1e8,
						floorPrice: Number((+collection.floorPrice / 1e8).toFixed(9)),
					}));
				}
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

	const toggleOfferTypeDropdown = () => {
		setOpenOfferTypeDropdown(!openOfferTypeDropdown);
	};

	const handleOfferTypeChange = (type: "ITEM" | "COLLECTION") => {
		setOfferType(type);
		setOpenOfferTypeDropdown(false);
		setFormState((prevState) => ({
			...prevState,
			offerType: type,
		}));
	};

	return (
		<div className='py-[30px] px-[40px]'>
			{isOpen && (
				<div className='max-h-[80vh] my-8'>
					<div className='absolute left-[25%] right-[25%] flex items-center justify-center z-[99] overflow-y-auto'>
						<div className='mt-6 w-[768px] border border-[#343B4F] rounded-xl p-8 bg-[#0b1739]'>
							<div className='flex justify-between items-center'>
								<h2 className='text-xl font-semibold text-white'>
									{editIndex !== null
										? "Edit Collection"
										: "Add New Collection"}
								</h2>

								<button
									className='text-white hover:text-gray-300'
									onClick={handleClose}>
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
							{!apiKey ? (
								<span className='bg-red-100 text-red-800 text-xs font-medium px-2.5 py-0.5 rounded'>
									NFT TOOLS API KEY not set, please add key in &nbsp;
									<Link href='/settings' className='underline'>
										settings
									</Link>
									&nbsp; to verify your collections
								</span>
							) : null}
							<div className='mt-6'>
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
									disabled={!apiKey}
								/>
							</div>

							<div className='mt-6 relative'>
								<label
									htmlFor='offer_type'
									className='block mb-2 text-sm font-medium text-white'>
									OFFER TYPE
								</label>
								<div className='relative'>
									<button
										type='button'
										className='p-[14px] bg-transparent border border-[#343B4F] w-full rounded text-white flex items-center justify-between'
										onClick={toggleOfferTypeDropdown}>
										<span className='text-white'>{offerType}</span>
										<ChevronDownIcon
											className={`w-5 h-5 ml-2 transition-transform ${
												openOfferTypeDropdown ? "transform rotate-180" : ""
											}`}
										/>
									</button>
									{openOfferTypeDropdown && (
										<div className='absolute z-10 w-full bg-[#1A2342] border border-[#343B4F] rounded shadow-lg mt-1'>
											<div
												className={`p-[14px] text-white cursor-pointer hover:bg-[#343B4F] ${
													offerType === "ITEM" ? "bg-[#343B4F]" : ""
												}`}
												onClick={() => handleOfferTypeChange("ITEM")}>
												ITEM
											</div>
											<div
												className={`p-[14px] text-white cursor-pointer hover:bg-[#343B4F] ${
													offerType === "COLLECTION" ? "bg-[#343B4F]" : ""
												}`}
												onClick={() => handleOfferTypeChange("COLLECTION")}>
												COLLECTION
											</div>
										</div>
									)}
								</div>
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
									FUNDING WALLET
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
														(wallet) => wallet.address === selectedWallet
												  )?.address
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
													onClick={() => handleWalletChange(wallet.address)}>
													{wallet.address}
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
								formState={formState}
								floorPrice={collectionDetails.floorPrice}
							/>

							<div className='mt-6 flex space-x-4'>
								<div>
									<label
										htmlFor='min_bid'
										className='block mb-2 text-sm font-medium text-white'>
										MIN BID <span className='text-[#998ca6]'>(BTC)</span>
									</label>
									<input
										type='number'
										id='min_bid'
										className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
										placeholder={
											collectionDetails.floorPrice && formState.minBid === 0
												? (collectionDetails.floorPrice * 0.5).toString()
												: formState.minBid > 0
												? formState.minBid.toString()
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
										MAX BID <span className='text-[#998ca6]'>(BTC)</span>
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
								<div>
									<label
										htmlFor='max_bid'
										className='block mb-2 text-sm font-medium text-white'>
										BUY QUANTITY <span className='text-[#998ca6]'></span>
									</label>
									<input
										type='number'
										id='quantity'
										className='p-[14px] bg-transparent border border-[#343B4F] rounded text-white inline-block w-auto'
										placeholder=''
										inputMode='numeric'
										value={formState.quantity}
										onChange={(e) => handleNumberInputChange(e, "quantity")}
										required
									/>
								</div>
							</div>

							<div className='mt-6 flex items-center space-x-4'>
								<div>
									<label
										htmlFor='scheduled_loop'
										className='block mb-2 text-sm font-medium text-white'>
										SCHEDULED LOOP{" "}
										<span className='text-[#998ca6]'>(seconds)</span>
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
								<div className='h-[82px]'>
									<label
										htmlFor='enableCounterbidding'
										className='block mb-2 text-sm font-medium text-white uppercase'>
										Enable Counterbidding
									</label>
									<label
										className='inline-flex relative items-center cursor-pointer mt-4'
										id='enableCounterbidding'>
										<input
											id='enableCounterbidding'
											type='checkbox'
											className='sr-only peer'
											checked={formState.enableCounterbidding}
											onChange={() =>
												handleToggleChange("enableCounterbidding")
											}
										/>
										<div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#CB3CFF]"></div>
									</label>
								</div>
							</div>
							<div className='mt-6 flex space-x-4'>
								<div>
									<label
										htmlFor='out_bid_margin'
										className='block mb-2 text-sm font-medium text-white'>
										OUT BID MARGIN <span className='text-[#998ca6]'>(BTC)</span>
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
										DURATION <span className='text-[#998ca6]'>(minutes)</span>
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
									className={`py-[14px] w-[180px] font-semibold text-sm rounded 
    ${
			!collectionDetails.symbol ||
			!collectionDetails.floorPrice ||
			(!isOrdinalAddress && !defaultTokenReceiveAddress)
				? "bg-gray-400 cursor-not-allowed w-[140px] text-white font-medium text-xs py-2 px-4 rounded"
				: "bg-[#CB3CFF] w-[140px] text-white font-medium text-xs py-2 px-4 rounded"
		}
  `}
									onClick={handleAddCollection}
									disabled={
										!collectionDetails.symbol ||
										!collectionDetails.floorPrice ||
										(!isOrdinalAddress && !defaultTokenReceiveAddress)
									}>
									{editIndex !== null ? "SAVE" : "ADD"}
								</button>
							</div>
						</div>
					</div>
				</div>
			)}
			<h2 className='text-white text-[20px] font-semibold'>My Tasks</h2>
			<p className='mt-2 text-[14px] font-medium text-[#AEB9E1]'>
				You have {collections.length} task(s) to bid on
			</p>

			<div className='mt-6'>
				<div className='flex justify-between gap-2 mb-6'>
					<button
						className='bg-[#CB3CFF] text-white font-medium text-xs py-2 px-4 rounded flex gap-2 w-[140px] justify-evenly'
						onClick={() => setIsOpen(true)}>
						Add New Task
						<PlusIcon />
					</button>
					<div className='flex gap-2'>
						<button
							className='bg-[#CB3CFF] w-[140px] text-white font-medium text-xs py-2 px-4 rounded'
							onClick={() => startAll(selectedCollections)}>
							Start Selected
						</button>
						<button
							className='bg-red-500 w-[140px] text-white font-medium text-xs py-2 px-4 rounded'
							onClick={() => stopAll(selectedCollections)}>
							Stop Selected
						</button>
					</div>
				</div>
				<div className='relative overflow-x-auto shadow-md'>
					<table className='w-full text-xs text-left text-white border border-[#343B4F] rounded-lg'>
						<thead className='text-xs bg-[#0A1330]'>
							<tr>
								<th scope='col' className='p-4 text-center'>
									<div className='flex items-center'>
										<input
											id='checkbox-all-search'
											type='checkbox'
											className='w-4 h-4 text-[#CB3CFF] bg-gray-100 border-gray-300 rounded focus:ring-[#CB3CFF] dark:focus:ring-[#CB3CFF] dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
											checked={selectedCollections.length === bidStates.length}
											onChange={handleSelectAllBidsChange}
											style={{ accentColor: "#CB3CFF" }}
										/>
										<label htmlFor='checkbox-all-search' className='sr-only'>
											Select All
										</label>
									</div>
								</th>
								<th scope='col' className='px-6 py-5 text-center'>
									Collection Symbol
								</th>
								<th scope='col' className='px-6 py-5 text-center'>
									Min Bid
								</th>
								<th scope='col' className='px-6 py-5 text-center'>
									Max Bid
								</th>
								<th scope='col' className='px-6 py-5 text-center'>
									Min Floor Bid
								</th>
								<th scope='col' className='px-6 py-5 text-center'>
									Max Floor Bid
								</th>
								<th scope='col' className='px-6 py-5 text-center'>
									Outbid Margin
								</th>
								<th scope='col' className='px-6 py-5 text-center'>
									Bid Count
								</th>
								<th scope='col' className='px-6 py-5 text-center'>
									Duration
								</th>
								<th scope='col' className='py-5 text-center'>
									Status
								</th>
								<th scope='col' className='px-6 py-5 text-center'>
									Action
								</th>
							</tr>
						</thead>

						<tbody>
							{combinedCollections.length > 0 ? (
								combinedCollections.map((bidState, index) => (
									<tr
										key={index}
										className={`${
											index % 2 === 0 ? "bg-[#0b1739]" : "bg-[#091330]"
										}`}>
										<td className='w-4 p-4 text-center'>
											<div className='flex items-center'>
												<input
													id={`checkbox-table-search-${index}`}
													type='checkbox'
													className='w-4 h-4 text-[#CB3CFF] bg-gray-100 border-gray-300 rounded focus:ring-[#CB3CFF] dark:focus:ring-[#CB3CFF] dark:ring-offset-gray-800 dark:focus:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600'
													style={{ accentColor: "#CB3CFF" }}
													checked={selectedCollections.includes(
														bidState.collectionSymbol
													)}
													onChange={() =>
														handleBidCheckboxChange(bidState.collectionSymbol)
													}
												/>
												<label
													htmlFor={`checkbox-table-search-${index}`}
													className='sr-only'>
													Select Bid
												</label>
											</div>
										</td>
										<th
											scope='row'
											className='px-6 py-5 text-center font-medium text-gray-900 whitespace-nowrap dark:text-white'>
											<Link
												href={{
													pathname: `/bids/${bidState.collectionSymbol}`,
													query: { data: JSON.stringify(bidState) },
												}}
												className='underline font-semibold text-center text-white'>
												{bidState.collectionSymbol}
											</Link>
										</th>
										<td className='px-6 py-5 text-center'>{bidState.minBid}</td>
										<td className='px-6 py-5 text-center'>{bidState.maxBid}</td>
										<td className='px-6 py-5 text-center'>
											{bidState.minFloorBid}
										</td>
										<td className='px-6 py-5 text-center'>
											{bidState.maxFloorBid}
										</td>
										<td className='px-6 py-5 text-center'>
											{bidState.outBidMargin}
										</td>
										<td className='px-6 py-5 text-center'>
											{bidState.bidCount}
										</td>
										<td className='px-6 py-5 text-center'>
											{bidState.duration}
										</td>
										<td className='px-6 py-5 text-center'>
											{bidState.running ? (
												<div className='bg-green-500 w-4 h-4 rounded-full text-center ring ring-green-400 ring-opacity-50'></div>
											) : (
												<div className='bg-[#AEB9E1] w-4 h-4 rounded-full'></div>
											)}
										</td>
										<td className='flex items-center px-6 py-5'>
											<button
												className={`font-medium text-center ${
													bidState.running
														? "text-red-600 hover:underline"
														: "text-green-600 hover:underline"
												}`}
												onClick={() => {
													bidState.running ? stopBid(index) : startBid(index);
												}}>
												{bidState.running ? "Stop" : "Start"}
											</button>

											<button
												onClick={() => onEdit(index)}
												className='font-medium text-blue-600 dark:text-blue-500 hover:underline ms-3'>
												Edit
											</button>
											<button
												onClick={() => handleRemoveCollection(index)}
												className='font-medium text-red-600 dark:text-red-500 hover:underline ms-3'>
												Remove
											</button>
										</td>
									</tr>
								))
							) : (
								<tr>
									<td>No data available</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
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
	quantity: number;
	enableCounterbidding: boolean;
	offerType: "ITEM" | "COLLECTION";
	fundingWalletWIF?: string;
	tokenReceiveAddress?: string;
	scheduledLoop?: number;
	floorPrice?: number;
}

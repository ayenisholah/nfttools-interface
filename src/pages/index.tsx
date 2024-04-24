import { BidState, useBidStateStore } from "@/store/bid.store";
import { useCollectionsState } from "@/store/collections.store";
import { useSettingsState } from "@/store/settings.store";
import { useEffect, useState } from "react";

export default function Home() {
	const {
		fundingWif,
		tokenReceiveAddress,
		defaultLoopTime,
		defaultCounterLoopTime,
		rateLimit,
		apiKey,
	} = useSettingsState();
	const { bidStates, setBidStates, startAll, stopAll, startBid, stopBid } =
		useBidStateStore();
	const { collections } = useCollectionsState();

	useEffect(() => {
		if (bidStates.length === 0) {
			const bids: BidState[] = collections.map((collection) => ({
				...collection,
				fundingWalletWIF: collection.fundingWalletWIF || fundingWif,
				tokenReceiveAddress:
					collection.tokenReceiveAddress || tokenReceiveAddress,
				scheduledLoop: collection.scheduledLoop || defaultLoopTime,
				counterbidLoop: collection.counterbidLoop || defaultCounterLoopTime,
				running: false,
			}));
			setBidStates(bids);
		}
	}, [
		bidStates.length,
		collections,
		defaultCounterLoopTime,
		defaultLoopTime,
		fundingWif,
		setBidStates,
		tokenReceiveAddress,
	]);

	const [selectedCollections, setSelectedCollections] = useState<string[]>([]);

	const handleSelectAllBidsChange = (
		event: React.ChangeEvent<HTMLInputElement>
	) => {
		setSelectedCollections(
			event.target.checked
				? bidStates.map((bidState) => bidState.collectionSymbol)
				: []
		);
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
		class Mutex {
			private locked: boolean;
			private waitQueue: (() => void)[];

			constructor() {
				this.locked = false;
				this.waitQueue = [];
			}

			async acquire() {
				if (this.locked) {
					await new Promise<void>((resolve) => this.waitQueue.push(resolve));
				}
				this.locked = true;
			}

			release() {
				if (this.waitQueue.length > 0) {
					const resolve = this.waitQueue.shift();
					resolve?.();
				} else {
					this.locked = false;
				}
			}
		}
		const active = bidStates.filter((bid) => bid.running === true);

		async function startProcessing() {
			// Run processScheduledLoop and processCounterBidLoop for each item concurrently
			await Promise.all(
				active.map(async (item) => {
					let isScheduledLoopRunning = false;
					let isCounterBidLoopRunning = false;
					let mutex = new Mutex();

					// Start processScheduledLoop and processCounterBidLoop loops concurrently for the item
					await Promise.all([
						(async () => {
							while (true) {
								await mutex.acquire();
								if (!isCounterBidLoopRunning) {
									isScheduledLoopRunning = true;
									fetch("/api/bid", {
										method: "POST",
										headers: {
											"Content-Type": "application/json",
										},
										body: JSON.stringify({
											requestType: "processScheduledLoop",
											data: { ...item, apiKey, rateLimit },
										}),
									});
									isScheduledLoopRunning = false;
								}
								mutex.release();
								await delay(item.scheduledLoop * 1000);
							}
						})(),
						(async () => {
							while (true) {
								await mutex.acquire();
								if (!isScheduledLoopRunning) {
									isCounterBidLoopRunning = true;
									// await processCounterBidLoop(item);
									// call counter bid api
									isCounterBidLoopRunning = false;
								}
								mutex.release();
								await delay(item.counterbidLoop * 1000);
							}
						})(),
					]);
				})
			);
		}

		startProcessing();

		function delay(ms: number) {
			return new Promise((resolve) => setTimeout(resolve, ms));
		}
	}, [bidStates]);

	return (
		<div className='py-[30px] px-[40px]'>
			<h2 className='text-white text-[20px] font-semibold'>My Activity</h2>
			<p className='mt-2 text-[14px] font-medium text-[#AEB9E1]'>
				You have {collections.length} collection(s) to bid on
			</p>
			<div className='mt-6'>
				<div className='flex justify-end gap-2 mb-6'>
					<button
						className='bg-[#CB3CFF] text-white font-semibold py-2 px-4 rounded'
						onClick={() => startAll(selectedCollections)}>
						Start
					</button>
					<button
						className='bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded'
						onClick={() => stopAll(selectedCollections)}>
						Stop
					</button>
				</div>
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
											checked={selectedCollections.length === bidStates.length}
											onChange={handleSelectAllBidsChange}
											style={{ accentColor: "#CB3CFF" }}
										/>
										<label htmlFor='checkbox-all-search' className='sr-only'>
											Select All
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
									Status
								</th>
								<th scope='col' className='px-6 py-5'>
									Action
								</th>
							</tr>
						</thead>
						<tbody>
							{bidStates.map((bidState, index) => (
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
									<td
										scope='row'
										className='px-6 py-5 font-medium text-gray-900 whitespace-nowrap dark:text-white text-center'>
										{bidState.collectionSymbol}
									</td>
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
									<td className='px-6 py-5 text-center'>{bidState.bidCount}</td>
									<td className='px-6 py-5 text-center'>{bidState.duration}</td>
									<td className='px-6 py-5 text-center'>
										{bidState.running ? (
											<div className='bg-green-500 w-4 h-4 rounded-full text-center ring ring-green-400 ring-opacity-50'></div>
										) : (
											<div className='bg-[#AEB9E1] w-4 h-4 rounded-full text-center'></div>
										)}
									</td>
									<td className='flex items-center px-6 py-5'>
										<button
											className={`font-medium ${
												bidState.running
													? "text-red-600 hover:underline"
													: "text-green-600 hover:underline"
											}`}
											onClick={() => {
												bidState.running ? stopBid(index) : startBid(index);
											}}>
											{bidState.running ? "Stop" : "Start"}
										</button>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>{" "}
		</div>
	);
}
